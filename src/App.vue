<template>
  <div class="app-container">
    <h1>Vue 3 PWA - Auto Retry Failed Requests</h1>
    <button class="fetch-btn" @click="fetchPosts">Fetch Posts</button>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <div class="card-grid">
      <div class="card" v-for="post in posts" :key="post.id">
        <h2 class="card-title">{{ post.title }}</h2>
        <p class="card-body">{{ post.body }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";

const posts = ref([]);
const errorMsg = ref("");

// Function to update error message based on online status
const updateNetworkStatus = () => {
  errorMsg.value = navigator.onLine
    ? ""
    : "You are offline. The request will be retried automatically.";
};

const fetchPosts = async () => {
  updateNetworkStatus(); // Check network before request
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts");
    if (!response.ok) throw new Error("Failed to fetch data");
    posts.value = await response.json();
  } catch (error) {
    console.log(error);
  }
};

// Listen for messages from the service worker
onMounted(() => {
  // Set initial status
  updateNetworkStatus();

  // Add online/offline listeners
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "RETRY_SUCCESS") {
        posts.value = event.data.data; // Update posts with retried data
      }
    });
  }
});

onBeforeUnmount(() => {
  // Clean up listeners
  window.removeEventListener("online", updateNetworkStatus);
  window.removeEventListener("offline", updateNetworkStatus);
});
</script>

<style scoped>
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

h1 {
  font-size: 2rem;
  margin-bottom: 20px;
}

.fetch-btn {
  padding: 10px 20px;
  font-size: 1rem;
  background-color: #3f51b5;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 20px;
  transition: background-color 0.3s;
}
.fetch-btn:hover {
  background-color: #303f9f;
}

.error {
  color: #e53935;
  margin-bottom: 20px;
  font-weight: bold;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  padding-top: 10px;
}

.card {
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 20px;
  text-align: left;
  transition: transform 0.2s ease;
}
.card:hover {
  transform: translateY(-4px);
}

.card-title {
  font-size: 1.1rem;
  font-weight: bold;
  margin-bottom: 10px;
  color: #333;
}

.card-body {
  font-size: 0.95rem;
  color: #666;
  white-space: pre-line;
}
</style>
