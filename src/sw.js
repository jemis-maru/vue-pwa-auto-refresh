const API_URLS = ["https://jsonplaceholder.typicode.com/posts"];
const DB_NAME = "offline-requests";

// Open IndexedDB for storing failed requests
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject("Failed to open IndexedDB");
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("requests")) {
        db.createObjectStore("requests", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
  });
};

// Save request in IndexedDB when offline
const saveRequest = async (request) => {
  try {
    const db = await openDB();
    const transaction = db.transaction("requests", "readwrite");
    const store = transaction.objectStore("requests");

    const addRequest = store.add(request);

    addRequest.onerror = (event) =>
      console.error("Failed to store request:", event.target.error);
  } catch (error) {
    console.error("Error saving request to IndexedDB:", error);
  }
};

// Send stored requests when online
const sendStoredRequests = async () => {
  const db = await openDB();
  const transaction = db.transaction("requests", "readwrite");
  const store = transaction.objectStore("requests");

  store.getAll().onsuccess = async (event) => {
    const requests = event.target.result;
    for (const req of requests) {
      try {
        const response = await fetch(req.url, req.options);
        const responseData = await response.json();

        // Send message to Vue app
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "RETRY_SUCCESS", data: responseData });
          });
        });

        // Create a NEW transaction for deletion
        const deleteTx = db.transaction("requests", "readwrite");
        const deleteStore = deleteTx.objectStore("requests");
        deleteStore.delete(req.id);
      } catch (error) {
        console.log("Retry failed, will try again later:", error);
      }
    }
  };
};

// Background Sync event listener
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-failed-requests") {
    event.waitUntil(sendStoredRequests());
  }
});

// Install event
self.addEventListener("install", () => {
  self.skipWaiting(); // Activate immediately
});

// Activate event
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function handleOfflineRequest(request) {
  // Clone and store the failed request
  const requestClone = {
    url: request.url,
    options: {
      method: request.method,
      headers: Object.fromEntries(request.headers),
      body: request.method !== "GET" ? await request.clone().text() : null,
    },
  };

  await saveRequest(requestClone);

  // Register Background Sync
  if ("SyncManager" in self) {
    self.registration.sync
      .register("sync-failed-requests")
      .catch((err) =>
        console.error("Failed to register background sync:", err)
      );
  }

  return new Response(
    JSON.stringify({
      message: "Request stored offline. Will retry when online.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
}

// Fetch event listener to intercept API calls
self.addEventListener("fetch", (event) => {
  if (API_URLS.some((url) => event.request.url.includes(url))) {
    if (!navigator.onLine) {
      // Directly detect offline state and store the request
      event.respondWith(handleOfflineRequest(event.request));
    }
  }
});
