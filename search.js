
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, disableNetwork } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Set up Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCdQD76M1BsVvYz1wqBG3wQjrzYFAxcFhw",
  authDomain: "medianest-b5bbe.firebaseapp.com",
  databaseURL: "https://medianest-b5bbe-default-rtdb.firebaseio.com",
  projectId: "medianest-b5bbe",
  storageBucket: "medianest-b5bbe.appspot.com",
  messagingSenderId: "38562067961",
  appId: "1:38562067961:web:0c76369a869e4270ff3928"
};

// Start Firebase
console.log("Initializing Firebase...");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Disable Firestore offline persistence to avoid storage errors
disableNetwork(db).then(() => {
  console.log("Firestore offline persistence disabled");
}).catch((error) => {
  console.error("Error disabling Firestore offline persistence:", error);
});

// Function to retry authentication with exponential backoff
async function retryAuth(maxAttempts = 8, baseDelay = 2000) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    if (auth.currentUser) {
      console.log("Auth retry successful, user:", auth.currentUser.uid);
      return auth.currentUser;
    }
    const delay = baseDelay * Math.pow(2, attempts);
    console.log(`Auth retry attempt ${attempts + 1}/${maxAttempts}, waiting ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    attempts++;
  }
  console.error("Auth retry failed after max attempts");
  return null;
}

// Function to retry Firestore query
async function retryFirestoreQuery(queryFn, maxAttempts = 3, delay = 2000) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      const result = await queryFn();
      console.log("Firestore query successful");
      return result;
    } catch (error) {
      console.error(`Firestore query attempt ${attempts + 1}/${maxAttempts} failed:`, error);
      attempts++;
      if (attempts < maxAttempts) {
        console.log(`Retrying Firestore query in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error("Firestore query failed after max attempts");
}

// Function to retry DOM updates
async function retryDOMUpdate(updateFn, maxAttempts = 3, delay = 500) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      updateFn();
      console.log("DOM update successful");
      return;
    } catch (error) {
      console.error(`DOM update attempt ${attempts + 1}/${maxAttempts} failed:`, error);
      attempts++;
      if (attempts < maxAttempts) {
        console.log(`Retrying DOM update in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error("DOM update failed after max attempts");
}

// Function to validate and log DOM elements
function validateDOMElements() {
  const recentSearchesList = document.getElementById("recentSearches");
  const resultsContainer = document.getElementById("resultsContainer");
  const loadingIndicator = document.getElementById("loadingText");
  if (recentSearchesList) {
    const styles = window.getComputedStyle(recentSearchesList);
    console.log("recentSearches styles:", {
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
      height: styles.height
    });
  } else {
    console.error("Error: <ul id='recentSearches'> not found in DOM");
  }
  if (resultsContainer) {
    const styles = window.getComputedStyle(resultsContainer);
    console.log("resultsContainer styles:", {
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
      height: styles.height
    });
  } else {
    console.error("Error: <div id='resultsContainer'> not found in DOM");
  }
  if (!loadingIndicator) console.error("Error: <div id='loadingText'> not found in DOM");
  return { recentSearchesList, resultsContainer, loadingIndicator };
}

// Function to test image URL
async function testImageUrl(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', mode: 'cors' });
    if (response.ok) {
      console.log(`Image URL valid: ${url}`);
      return true;
    } else {
      console.error(`Image URL invalid (status ${response.status}): ${url}`);
      return false;
    }
  } catch (error) {
    console.error(`Error testing image URL ${url}:`, error);
    return false;
  }
}

// Function to load cached searches from localStorage
function loadCachedSearches() {
  const { recentSearchesList } = validateDOMElements();
  if (!recentSearchesList) return;

  retryDOMUpdate(() => {
    const cachedSearches = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    if (cachedSearches.length === 0) {
      recentSearchesList.innerHTML = "<p>No recent searches yet.</p>";
      console.log("No cached searches found");
      return;
    }
    recentSearchesList.innerHTML = "";
    cachedSearches.forEach((data, index) => {
      console.log("Rendering cached search:", data);
      const listItem = document.createElement("li");
      listItem.innerHTML = `
        ${data.query} (${data.mediaType}, ${data.license || 'Any License'})
        <button onclick="deleteCachedSearch(${index})" aria-label="Delete search">Delete</button>
      `;
      listItem.onclick = (e) => {
        if (e.target.tagName !== "BUTTON") {
          document.getElementById("searchInput").value = data.query;
          document.getElementById("mediaType").value = data.mediaType;
          document.getElementById("licenseType").value = data.license || "";
          searchMedia();
        }
      };
      recentSearchesList.appendChild(listItem);
    });
    // Force DOM refresh
    requestAnimationFrame(() => {
      recentSearchesList.style.display = 'none';
      recentSearchesList.offsetHeight; // Trigger reflow
      recentSearchesList.style.display = 'block';
      console.log("Forced DOM refresh for recentSearches");
    });
  });
}

// Function to delete cached search
function deleteCachedSearch(index) {
  retryDOMUpdate(() => {
    const cachedSearches = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    cachedSearches.splice(index, 1);
    localStorage.setItem("recentSearches", JSON.stringify(cachedSearches));
    loadCachedSearches();
  });
}

// Function to log out user
export function logoutUser() {
  signOut(auth)
    .then(() => {
      console.log("User logged out successfully");
      localStorage.removeItem("recentSearches");
      alert("Logged out!");
      window.location.href = "login.html";
    })
    .catch((error) => {
      console.error("Logout error:", error);
      alert("Error logging out: " + error.message);
    });
}

// Check if user is logged in
onAuthStateChanged(auth, async (user) => {
  console.log("Auth state changed, user:", user ? user.uid : null);
  validateDOMElements();
  if (!user) {
    console.log("No user logged in, attempting retry...");
    const retriedUser = await retryAuth();
    if (!retriedUser) {
      console.log("No user after retry, loading cached searches");
      loadCachedSearches();
      window.location.href = "login.html";
    } else {
      setTimeout(() => loadRecentSearches(retriedUser), 2000);
    }
  } else {
    console.log("User authenticated:", user.uid);
    setTimeout(() => loadRecentSearches(user), 2000);
  }
});

// Function to search for media
export async function searchMedia() {
  const { resultsContainer, loadingIndicator } = validateDOMElements();
  const searchInput = document.getElementById("searchInput").value.trim();
  const selectedMediaType = document.getElementById("mediaType").value;
  const selectedLicense = document.getElementById("licenseType").value;

  if (!resultsContainer || !loadingIndicator) return;
  if (!searchInput) {
    alert("Please enter a search term.");
    return;
  }

  // Show loading message
  requestAnimationFrame(() => {
    loadingIndicator.style.display = "block";
  });

  try {
    // Save search to history before fetching
    await saveSearchHistory(searchInput, selectedMediaType, selectedLicense);

    // Build API URL
    const apiUrl = `https://medianest-backend.onrender.com/api/search?q=${encodeURIComponent(searchInput)}&mediaType=${selectedMediaType}&license=${selectedLicense}`;
    console.log("Fetching from API:", apiUrl);
    const response = await fetch(apiUrl);
    let errorMessage = `Failed to fetch media. Status: ${response.status}`;
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 400) {
        errorMessage = errorData.error || 'Invalid search parameters, maybe wrong license type';
      } else if (response.status === 401) {
        errorMessage = 'Authentication error: Invalid API credentials';
      } else if (response.status === 429) {
        errorMessage = 'Too many requests. Try again later';
      } else {
        errorMessage = errorData.error || errorMessage;
      }
      throw new Error(errorMessage);
    }
    const data = await response.json();
    console.log("Openverse API response:", JSON.stringify(data, null, 2));

    // Clear results container
    resultsContainer.innerHTML = "";

    // Check if no results found
    if (!data.results || data.results.length === 0) {
      resultsContainer.innerHTML = `<p style="color:red;">No results found for ${selectedLicense ? `"${selectedLicense}" license` : 'this license'}. Try another license or search term.</p>`;
      return;
    }

    // Show search results
    for (const [index, item] of data.results.entries()) {
      console.log(`Processing item ${index}:`, item);
      if (!item.url) {
        console.error(`Item ${index} has no URL`);
        continue;
      }

      // Test image URL or use fallback
      let imageUrl = item.url;
      if (selectedMediaType === "images") {
        const isValidUrl = await testImageUrl(item.url);
        if (!isValidUrl) {
          console.warn(`Falling back to placeholder for item ${index}`);
          imageUrl = "https://placehold.co/150x150?text=Image+Not+Found";
        }
      }

      const mediaItem = document.createElement("div");
      mediaItem.classList.add("media-item");

      if (selectedMediaType === "images") {
        console.log("Rendering image:", imageUrl);
        mediaItem.innerHTML = `
          <img src="${imageUrl}" alt="${item.title || 'Image'}" style="width: 100%; border-radius: 8px;" onerror="this.src='https://placehold.co/150x150?text=Image+Not+Found'; this.alt='Image not available'; console.error('Failed to load image: ${imageUrl}');">
          <h3 class="media-title">${item.title || 'Untitled'}</h3>
          <p>Creator: ${item.creator || 'Unknown'}</p>
          <p>License: ${item.license || 'Unknown'}</p>
        `;
      } else if (selectedMediaType === "audio" && item.url) {
        console.log("Rendering audio:", item.url);
        mediaItem.innerHTML = `
          <h3 class="media-title">${item.title || 'Untitled'}</h3>
          <p>Creator: ${item.creator || 'Unknown'}</p>
          <p>License: ${item.license || 'Unknown'}</p>
          <audio controls>
            <source src="${item.url}" type="audio/mpeg">
            Your browser does not support the audio element.
          </audio>
        `;
      } else {
        console.error(`Item ${index} is not renderable:`, item);
        mediaItem.innerHTML = `<p>Media not available</p>`;
      }

      retryDOMUpdate(() => {
        resultsContainer.appendChild(mediaItem);
        console.log(`Appended mediaItem ${index} to resultsContainer`);
        // Force DOM refresh
        requestAnimationFrame(() => {
          resultsContainer.style.display = 'none';
          resultsContainer.offsetHeight; // Trigger reflow
          resultsContainer.style.display = 'block';
        });
      });
    }

  } catch (error) {
    console.error("Error fetching media:", error);
    resultsContainer.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
  } finally {
    // Hide loading message
    requestAnimationFrame(() => {
      loadingIndicator.style.display = "none";
    });
  }
}

// Function to save search history
async function saveSearchHistory(query, mediaType, license) {
  const currentUser = auth.currentUser || await retryAuth();
  const searchData = { query, mediaType, license, timestamp: new Date() };

  // Save to localStorage first
  try {
    const cachedSearches = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    cachedSearches.unshift(searchData);
    if (cachedSearches.length > 10) cachedSearches.pop();
    localStorage.setItem("recentSearches", JSON.stringify(cachedSearches));
    console.log("Saved search to localStorage:", searchData);
    loadCachedSearches(); // Immediate display
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }

  if (!currentUser) {
    console.error("No user logged in, cannot save search to Firestore");
    return;
  }

  try {
    await retryFirestoreQuery(async () => {
      return await addDoc(collection(db, "users", currentUser.uid, "searchHistory"), searchData);
    });
    console.log("Saved search to Firestore for user:", currentUser.uid);
    loadRecentSearches(currentUser); // Force reload
  } catch (error) {
    console.error("Error saving search to Firestore:", error);
    if (error.code === "permission-denied") {
      console.error("Check Firebase security rules for users/{userId}/searchHistory or authorized domains");
    }
  }
}

// Function to delete search history
async function deleteSearchHistory(docId) {
  const currentUser = auth.currentUser || await retryAuth();
  if (!currentUser) {
    console.error("No user logged in, cannot delete search");
    return;
  }

  retryDOMUpdate(() => {
    retryFirestoreQuery(async () => {
      return await deleteDoc(doc(db, "users", currentUser.uid, "searchHistory", docId));
    }).then(() => {
      console.log("Deleted search for user:", currentUser.uid);
      loadRecentSearches(currentUser);
    }).catch((error) => {
      console.error("Error deleting search:", error);
    });
  });
}

// Function to load recent searches
async function loadRecentSearches(user) {
  const { recentSearchesList } = validateDOMElements();
  if (!recentSearchesList) return;

  const currentUser = user || auth.currentUser || await retryAuth();
  if (!currentUser) {
    console.error("No user logged in for recent searches, loading cached searches");
    loadCachedSearches();
    return;
  }

  retryDOMUpdate(() => {
    recentSearchesList.innerHTML = "<p>Loading recent searches...</p>";
  });

  try {
    const querySnapshot = await retryFirestoreQuery(async () => {
      return await getDocs(collection(db, "users", currentUser.uid, "searchHistory"));
    });

    retryDOMUpdate(() => {
      // Clear loading message
      recentSearchesList.innerHTML = "";

      // Check if no searches exist
      if (querySnapshot.empty) {
        console.log("No recent searches found in Firestore for user:", currentUser.uid);
        loadCachedSearches();
        return;
      }

      // Show each search
      const searches = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log("Found search in Firestore:", data);
        searches.push({ id: doc.id, ...data });
      });

      // Update localStorage cache
      try {
        localStorage.setItem("recentSearches", JSON.stringify(searches.slice(0, 10)));
      } catch (error) {
        console.error("Error updating localStorage cache:", error);
      }

      // Display searches
      recentSearchesList.innerHTML = "";
      searches.forEach((data) => {
        const listItem = document.createElement("li");
        listItem.innerHTML = `
          ${data.query} (${data.mediaType}, ${data.license || 'Any License'})
          <button onclick="deleteSearchHistory('${data.id}')" aria-label="Delete search">Delete</button>
        `;
        listItem.onclick = (e) => {
          if (e.target.tagName !== "BUTTON") {
            document.getElementById("searchInput").value = data.query;
            document.getElementById("mediaType").value = data.mediaType;
            document.getElementById("licenseType").value = data.license || "";
            searchMedia();
          }
        };
        recentSearchesList.appendChild(listItem);
      });
      // Force DOM refresh
      requestAnimationFrame(() => {
        recentSearchesList.style.display = 'none';
        recentSearchesList.offsetHeight; // Trigger reflow
        recentSearchesList.style.display = 'block';
        console.log("Forced DOM refresh for recentSearches");
      });
    });
  } catch (error) {
    console.error("Error loading recent searches from Firestore:", error);
    let errorMessage = "Error loading recent searches: " + error.message;
    if (error.code === "unavailable" || error.message.includes("storage")) {
      errorMessage = "Unable to load recent searches due to browser privacy settings. Disable tracking prevention in Settings > Privacy (Safari/Edge) or Privacy & Security (Firefox), or try Chrome. Then, refresh the page.";
    } else if (error.code === "permission-denied") {
      errorMessage = "Unable to load recent searches: Ensure 'kenny543151.github.io' is added to Firebase Authorized Domains and security rules allow access.";
    } else if (error.code === "failed-precondition") {
      errorMessage = "Unable to load recent searches: Ensure Firestore is enabled in Firebase Console.";
    }
    retryDOMUpdate(() => {
      recentSearchesList.innerHTML = `<p style="color:red;">${errorMessage}</p>`;
      loadCachedSearches();
    });
  }
}

// Make functions available globally
window.searchMedia = searchMedia;
window.logoutUser = logoutUser;
window.deleteSearchHistory = deleteSearchHistory;
window.deleteCachedSearch = deleteCachedSearch;
