// List of API URLs to intercept and handle offline requests
const API_URLS = ["https://jsonplaceholder.typicode.com/posts"];

// Name of the IndexedDB database
const DB_NAME = "offline-requests";

/**
 * Open or create the IndexedDB database.
 * Used to store failed requests for retrying later.
 */
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject("Failed to open IndexedDB");
    request.onsuccess = () => resolve(request.result);

    // Create the "requests" object store if it doesn't exist
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

/**
 * Save a failed request in IndexedDB when the user is offline.
 * @param {Object} request - The request object containing URL and fetch options.
 */
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

/**
 * Retry sending all previously failed requests stored in IndexedDB.
 * Called when the Background Sync event is triggered.
 */
const sendStoredRequests = async () => {
  const db = await openDB();
  const transaction = db.transaction("requests", "readwrite");
  const store = transaction.objectStore("requests");

  // Retrieve all stored requests
  store.getAll().onsuccess = async (event) => {
    const requests = event.target.result;

    for (const req of requests) {
      try {
        // Attempt to resend the request
        const response = await fetch(req.url, req.options);
        const responseData = await response.json();

        // Inform the client (e.g., Vue app) of a successful retry
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "RETRY_SUCCESS", data: responseData });
          });
        });

        // Remove the request from IndexedDB after successful retry
        const deleteTx = db.transaction("requests", "readwrite");
        const deleteStore = deleteTx.objectStore("requests");
        deleteStore.delete(req.id);
      } catch (error) {
        console.log("Retry failed, will try again later:", error);
      }
    }
  };
};

/**
 * Background Sync event listener.
 * Triggers the retry of stored requests when the device is back online.
 */
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-failed-requests") {
    event.waitUntil(sendStoredRequests());
  }
});

/**
 * Service worker install event.
 * Skips waiting and activates the new worker immediately.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

/**
 * Service worker activate event.
 * Takes control of uncontrolled clients immediately.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Handle a fetch request when the user is offline.
 * Saves the request for later retry and responds with a fallback message.
 * @param {Request} request - The failed fetch request.
 */
async function handleOfflineRequest(request) {
  const requestClone = {
    url: request.url,
    options: {
      method: request.method,
      headers: Object.fromEntries(request.headers),
      body: request.method !== "GET" ? await request.clone().text() : null,
    },
  };

  // Save the failed request to IndexedDB
  await saveRequest(requestClone);

  // Register Background Sync to retry the request later
  if ("SyncManager" in self) {
    self.registration.sync
      .register("sync-failed-requests")
      .catch((err) =>
        console.error("Failed to register background sync:", err)
      );
  }

  // Respond to the client immediately with an offline notice
  return new Response(
    JSON.stringify({
      message: "Request stored offline. Will retry when online.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Fetch event listener to intercept requests to specific API URLs.
 * If offline, handles the request via handleOfflineRequest().
 */
self.addEventListener("fetch", (event) => {
  if (API_URLS.some((url) => event.request.url.includes(url))) {
    if (!navigator.onLine) {
      // Respond with offline handler if not connected
      event.respondWith(handleOfflineRequest(event.request));
    }
  }
});
