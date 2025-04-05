<template>
  <div class="app-container">
    <h1>Vue 3 PWA - Auto Retry Failed Requests</h1>

    <!-- Button to trigger fetchPosts -->
    <button class="fetch-btn" @click="fetchPosts">Fetch Posts</button>

    <!-- Display error message when offline -->
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <!-- Render posts in a grid layout -->
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

// Reactive variable to store fetched posts
const posts = ref([]);

// Reactive variable to store error message
const errorMsg = ref("");

// Function to update the error message based on online/offline status
const updateNetworkStatus = () => {
  errorMsg.value = navigator.onLine
    ? ""
    : "You are offline. The request will be retried automatically.";
};

/**
 * Fetch posts from API.
 * If the fetch fails (e.g., offline), the service worker will handle and store the request.
 */
const fetchPosts = async () => {
  updateNetworkStatus(); // Update message before attempting fetch

  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts");
    if (!response.ok) throw new Error("Failed to fetch data");

    // Update posts on success
    posts.value = await response.json();
  } catch (error) {
    // No errorMsg is set here, because updateNetworkStatus already does that
    console.log(error);
  }
};

// Lifecycle hook: runs when component is mounted
onMounted(() => {
  // Set initial network status
  updateNetworkStatus();

  // Listen for network status changes
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);

  // Listen for messages from the service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      // Check if message is a successful retry response
      if (event.data?.type === "RETRY_SUCCESS") {
        posts.value = event.data.data; // Update posts with data from retry
      }
    });
  }
});

// Lifecycle hook: clean up event listeners when component unmounts
onBeforeUnmount(() => {
  window.removeEventListener("online", updateNetworkStatus);
  window.removeEventListener("offline", updateNetworkStatus);
});
</script>

<!-- Css code -->
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
