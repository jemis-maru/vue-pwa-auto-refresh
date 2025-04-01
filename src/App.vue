<script setup>
import { ref, onMounted } from "vue";

const posts = ref([]);
const errorMsg = ref("");

const fetchPosts = async () => {
  errorMsg.value = "";
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts");
    if (!response.ok) throw new Error("Failed to fetch data");
    posts.value = await response.json();
  } catch (error) {
    errorMsg.value = "You are offline. The request will be retried automatically.";
  }
};

// Listen for messages from the service worker
onMounted(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "RETRY_SUCCESS") {
        posts.value = event.data.data; // Update posts with retried data
        console.log("Updated posts after retry:", posts.value);
      }
    });
  }
});
</script>

<template>
  <div>
    <h1>Vue 3 PWA - Auto Retry Failed Requests</h1>
    <button @click="fetchPosts">Fetch Posts</button>
    <p v-if="errorMsg">{{ errorMsg }}</p>
    <ul>
      <li v-for="post in posts" :key="post.id">{{ post.title }}</li>
    </ul>
  </div>
</template>

<style>
body {
  font-family: Arial, sans-serif;
  text-align: center;
  margin: 20px;
}
button {
  padding: 10px 20px;
  margin-bottom: 20px;
  font-size: 16px;
  cursor: pointer;
}
</style>
