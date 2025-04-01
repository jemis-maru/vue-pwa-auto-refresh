const CACHE_NAME = "app-cache-v1";
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

    addRequest.onsuccess = () =>
      console.log("Request stored successfully:", request);
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

        store.delete(req.id);
        console.log("Request retried and deleted:", req);
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

// Fetch event listener to intercept API calls
self.addEventListener("fetch", (event) => {
  if (API_URLS.some((url) => event.request.url.includes(url))) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        // Store the failed request when offline
        const requestClone = {
          url: event.request.url,
          options: {
            method: event.request.method,
            headers: Object.fromEntries(event.request.headers),
            body:
              event.request.method !== "GET"
                ? await event.request.clone().text()
                : null,
          },
        };

        await saveRequest(requestClone);

        // Register Background Sync
        if ("SyncManager" in self) {
          self.registration.sync
            .register("sync-failed-requests")
            .then(() => {
              console.log("Background sync registered");
            })
            .catch((err) => {
              console.error("Failed to register background sync:", err);
            });
        }

        return new Response(
          JSON.stringify({
            message: "Request stored offline. Will retry when online.",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      })
    );
  }
});
