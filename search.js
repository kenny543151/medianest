
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

// Function to load cached searches from localStorage
function loadCachedSearches() {
  const { recentSearchesList } = validateDOMElements();
  if (!recentSearchesList) return;

  try {
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
  } catch (error) {
    console.error("Error loading cached searches:", error);
    recentSearchesList.innerHTML = "<p>Unable to load cached searches due to browser restrictions.</p>";
  }
}

// Function to delete cached search
function deleteCachedSearch(index) {
  try {
    const cachedSearches = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    cachedSearches.splice(index, 1);
    localStorage.setItem("recentSearches", JSON.stringify(cachedSearches));
    loadCachedSearches();
  } catch (error) {
    console.error("Error deleting cached search:", error);
  }
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
onAuthStateChanged(auth, (user) => {
  console.log("Auth state changed, user:", user ? user.uid : null);
  validateDOMElements();
  if (!user) {
    console.log("No user logged in, loading cached searches");
    loadCachedSearches();
    window.location.href = "login.html";
  } else {
    console.log("User authenticated:", user.uid);
    setTimeout(() => loadRecentSearches(user), 1000);
  }
});

// Function to search for media
export async function searchMedia() {
  const { recentSearchesList, resultsContainer, loadingIndicator } = validateDOMElements();
  const searchInput = document.getElementById("searchInput").value.trim();
  const selectedMediaType = document.getElementById("mediaType").value;
  const selectedLicense = document.getElementById("licenseType").value;

  if (!resultsContainer || !loadingIndicator) return;
  if (!searchInput) {
    alert("Please enter a search term.");
    return;
  }

  // Show loading message
  loadingIndicator.style.display = "block";

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
    data.results.forEach((item) => {
      const mediaItem = document.createElement("div");
      mediaItem.classList.add("media-item");

      if (selectedMediaType === "images" && item.url) {
        console.log("Rendering image:", item.url);
        mediaItem.innerHTML = `
          <img src="${item.url}" alt="${item.title || 'Image'}" style="width: 100%; border-radius: 8px;" onerror="this.src='https://placehold.co/150x150?text=Image+Not+Found'; this.alt='Image not available'; console.error('Failed to load image: ${item.url}');">
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
        console.error("Media not available for item:", item);
        mediaItem.innerHTML = `<p>Media not available</p>`;
      }

      resultsContainer.appendChild(mediaItem);
    });

    // Refresh recent searches
    if (recentSearchesList) {
      loadCachedSearches();
    }

  } catch (error) {
    console.error("Error fetching media:", error);
    resultsContainer.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
  } finally {
    // Hide loading message
    loadingIndicator.style.display = "none";
  }
}

// Function to save search history
async function saveSearchHistory(query, mediaType, license) {
  const currentUser = auth.currentUser;
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
    await addDoc(collection(db, "users", currentUser.uid, "searchHistory"), searchData);
    console.log("Saved search to Firestore for user:", currentUser.uid);
    loadRecentSearches(currentUser);
  } catch (error) {
    console.error("Error saving search to Firestore:", error);
    if (error.code === "permission-denied") {
      console.error("Check Firebase security rules for users/{userId}/searchHistory or authorized domains");
    }
  }
}

// Function to delete search history
async function deleteSearchHistory(docId) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error("No user logged in, cannot delete search");
    return;
  }

  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "searchHistory", docId));
    console.log("Deleted search for user:", currentUser.uid);
    loadRecentSearches(currentUser);
  } catch (error) {
    console.error("Error deleting search:", error);
  }
}

// Function to load recent searches
async function loadRecentSearches(user) {
  const { recentSearchesList } = validateDOMElements();
  if (!recentSearchesList) return;

  const currentUser = user || auth.currentUser;
  if (!currentUser) {
    console.error("No user logged in for recent searches, loading cached searches");
    loadCachedSearches();
    return;
  }

  recentSearchesList.innerHTML = "<p>Loading recent searches...</p>";

  try {
    console.log("Fetching recent searches for user:", currentUser.uid);
    const querySnapshot = await getDocs(collection(db, "users", currentUser.uid, "searchHistory"));

    // Clear loading message
    recentSearchesList.innerHTML = "";

    // Check if no searches exist
    if (querySnapshot.empty) {
      console.log("No recent searches found in Firestore for user:", currentUser.uid);
      loadCachedSearches();
      return;
    }

    // Show each search
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log("Found search:", data);
      const listItem = document.createElement("li");
      listItem.innerHTML = `
        ${data.query} (${data.mediaType}, ${data.license || 'Any License'})
        <button onclick="deleteSearchHistory('${doc.id}')" aria-label="Delete search">Delete</button>
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
  } catch (error) {
    console.error("Error loading recent searches:", error);
    let errorMessage = "Error loading recent searches: " + error.message;
    if (error.code === "unavailable" || error.message.includes("storage")) {
      errorMessage = "Unable to load recent searches due to browser privacy settings. Try disabling tracking prevention or using Chrome.";
    } else if (error.code === "permission-denied") {
      errorMessage = "Unable to load recent searches: Ensure 'kenny543151.github.io' is added to Firebase Authorized Domains.";
    }
    recentSearchesList.innerHTML = `<p style="color:red;">${errorMessage}</p>`;
    loadCachedSearches();
  }
}

// Make functions available globally
window.searchMedia = searchMedia;
window.logoutUser = logoutUser;
window.deleteSearchHistory = deleteSearchHistory;
window.deleteCachedSearch = deleteCachedSearch;
