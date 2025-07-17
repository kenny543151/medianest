// MediaNest Search Script
// Written by OBIIO
// This code handles searching media (images, audio, videos) and showing search history

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

// Pexels API key
const PEXELS_API_KEY = "F6EjgGWyOfrdxCaWKJ7jUOhL8Eg3BxVc4UHZdkoSGXUjUgGx3ph3Ogyf";

// Function to validate DOM elements
function validateDOMElements() {
  const recentSearchesList = document.getElementById("recentSearches");
  const resultsContainer = document.getElementById("resultsContainer");
  const loadingIndicator = document.getElementById("loadingText");
  const licenseType = document.getElementById("licenseType");
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
  if (!licenseType) console.error("Error: <select id='licenseType'> not found in DOM");
  return { recentSearchesList, resultsContainer, loadingIndicator, licenseType };
}

// Function to toggle license selector visibility
function toggleLicenseSelector() {
  const mediaType = document.getElementById("mediaType").value;
  const licenseType = document.getElementById("licenseType");
  if (mediaType === "videos") {
    licenseType.style.display = "none";
    licenseType.value = ""; // Clear license for videos
  } else {
    licenseType.style.display = "block";
  }
}

// Initialize license selector toggle
document.addEventListener("DOMContentLoaded", () => {
  const mediaTypeSelect = document.getElementById("mediaType");
  if (mediaTypeSelect) {
    mediaTypeSelect.addEventListener("change", toggleLicenseSelector);
    toggleLicenseSelector(); // Initial check
  }
});

// Function to load cached searches from localStorage
function loadCachedSearches() {
  const { recentSearchesList } = validateDOMElements();
  if (!recentSearchesList) return;

  try {
    const cachedSearches = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    recentSearchesList.innerHTML = "";
    if (cachedSearches.length === 0) {
      recentSearchesList.innerHTML = "<p>No recent searches yet.</p>";
      console.log("No cached searches found");
      return;
    }
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
          toggleLicenseSelector();
          searchMedia();
        }
      };
      recentSearchesList.appendChild(listItem);
    });
  } catch (error) {
    console.error("Error loading cached searches:", error);
    recentSearchesList.innerHTML = "<p class='error'>Unable to load cached searches due to browser restrictions.</p>";
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
      localStorage.removeItem("cachedResults");
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
  loadCachedSearches(); // Load localStorage immediately
  if (!user) {
    console.log("No user logged in, using cached searches");
    window.location.href = "login.html";
  } else {
    console.log("User authenticated:", user.uid);
    loadRecentSearches(user); // Load Firestore in background
  }
});

// Function to fetch with timeout
async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Authorization: PEXELS_API_KEY } });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Function to get cached API results
function getCachedResults(query, mediaType, license) {
  try {
    const cacheKey = `${query}_${mediaType}_${license || 'none'}`;
    const cachedData = JSON.parse(localStorage.getItem("cachedResults") || "{}");
    if (cachedData[cacheKey] && cachedData[cacheKey].timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000) {
      console.log("Using cached API results for:", cacheKey);
      return cachedData[cacheKey].data;
    }
    return null;
  } catch (error) {
    console.error("Error accessing cached results:", error);
    return null;
  }
}

// Function to save API results to cache
function saveCachedResults(query, mediaType, license, data) {
  try {
    const cacheKey = `${query}_${mediaType}_${license || 'none'}`;
    const cachedData = JSON.parse(localStorage.getItem("cachedResults") || "{}");
    cachedData[cacheKey] = { data, timestamp: Date.now() };
    localStorage.setItem("cachedResults", JSON.stringify(cachedData));
    console.log("Saved API results to cache:", cacheKey);
  } catch (error) {
    console.error("Error saving cached results:", error);
  }
}

// Function to search for media
export async function searchMedia() {
  const { recentSearchesList, resultsContainer, loadingIndicator, licenseType } = validateDOMElements();
  const searchInput = document.getElementById("searchInput").value.trim();
  const selectedMediaType = document.getElementById("mediaType").value;
  const selectedLicense = selectedMediaType === "videos" ? "" : licenseType.value; // Ignore license for videos

  if (!resultsContainer || !loadingIndicator) return;
  if (!searchInput) {
    alert("Please enter a search term.");
    return;
  }

  // Show loading message
  loadingIndicator.classList.add("loading");
  loadingIndicator.style.display = "block";

  try {
    // Check for cached API results
    const cachedResults = getCachedResults(searchInput, selectedMediaType, selectedLicense);
    if (cachedResults) {
      renderResults(cachedResults, resultsContainer, selectedMediaType, selectedLicense);
      await saveSearchHistory(searchInput, selectedMediaType, selectedLicense);
      return;
    }

    // Build API URL
    let apiUrl;
    if (selectedMediaType === "images") {
      apiUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchInput)}&per_page=10`;
    } else if (selectedMediaType === "videos") {
      apiUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(searchInput)}&per_page=10`;
    } else {
      apiUrl = null; // Audio not supported by Pexels
    }

    let data;
    if (apiUrl) {
      console.log("Fetching from Pexels API:", apiUrl);
      const response = await fetchWithTimeout(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = `Failed to fetch media. Status: ${response.status}`;
        if (response.status === 400) errorMessage = errorData.error || "Invalid search parameters";
        else if (response.status === 401) errorMessage = "Invalid Pexels API key";
        else if (response.status === 429) errorMessage = "Pexels API rate limit exceeded";
        throw new Error(errorMessage);
      }
      data = await response.json();
      console.log("Pexels API response:", JSON.stringify(data, null, 2));
    } else {
      data = { results: [] }; // Fallback for audio
    }

    // Cache API results
    saveCachedResults(searchInput, selectedMediaType, selectedLicense, data);

    // Render results
    renderResults(data, resultsContainer, selectedMediaType, selectedLicense);

    // Save search history after rendering
    await saveSearchHistory(searchInput, selectedMediaType, selectedLicense);

  } catch (error) {
    console.error("Error fetching media:", error);
    if (error.name === "AbortError") {
      console.log("API request timed out, attempting fallback...");
      const cachedResults = getCachedResults(searchInput, selectedMediaType, selectedLicense);
      if (cachedResults) {
        renderResults(cachedResults, resultsContainer, selectedMediaType, selectedLicense);
        await saveSearchHistory(searchInput, selectedMediaType, selectedLicense);
        return;
      }
      // Fallback to default media
      resultsContainer.innerHTML = "";
      const mediaItem = document.createElement("div");
      mediaItem.classList.add("media-item");
      if (selectedMediaType === "images") {
        mediaItem.innerHTML = `
          <img src="https://placehold.co/300x200?text=Default+Image" alt="Default Image" class="media-content">
          <h3 class="media-title">Default Image</h3>
          <p>Creator: Unknown</p>
          <p>License: Unknown</p>
        `;
      } else if (selectedMediaType === "audio") {
        mediaItem.innerHTML = `
          <h3 class="media-title">Default Audio</h3>
          <p>Creator: Unknown</p>
          <p>License: Unknown</p>
          <audio controls class="media-content">
            <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg">
            Your browser does not support the audio element.
          </audio>
        `;
      } else if (selectedMediaType === "videos") {
        mediaItem.innerHTML = `
          <h3 class="media-title">Default Video</h3>
          <p>Creator: Unknown</p>
          <p>License: Unknown</p>
          <video controls class="media-content" poster="https://placehold.co/300x200?text=Default+Video">
            <source src="https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4" type="video/mp4">
            Your browser does not support the video element.
          </video>
        `;
      }
      resultsContainer.appendChild(mediaItem);
      await saveSearchHistory(searchInput, selectedMediaType, selectedLicense);
    } else {
      resultsContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
  } finally {
    // Hide loading message
    loadingIndicator.style.display = "none";
  }
}

// Function to render results
function renderResults(data, resultsContainer, mediaType, license) {
  resultsContainer.innerHTML = "";
  let results = [];
  if (mediaType === "images") {
    results = data.photos || [];
  } else if (mediaType === "videos") {
    results = data.videos || [];
  } else {
    results = []; // Audio not supported
  }

  if (results.length === 0) {
    resultsContainer.innerHTML = `<p class="error">No results found for ${license && mediaType !== "videos" ? `"${license}" license` : 'this search'}. Try another search term.</p>`;
    return;
  }

  results.forEach((item) => {
    const mediaItem = document.createElement("div");
    mediaItem.classList.add("media-item");

    if (mediaType === "images" && item.src?.medium) {
      console.log("Rendering image:", item.src.medium);
      mediaItem.innerHTML = `
        <img src="${item.src.medium}" alt="${item.alt || 'Image'}" class="media-content" onerror="this.src='https://placehold.co/300x200?text=Image+Not+Found'; this.alt='Image not available'; console.error('Failed to load image: ${item.src.medium}');">
        <h3 class="media-title">${item.alt || 'Untitled'}</h3>
        <p>Creator: ${item.photographer || 'Unknown'}</p>
        <p>License: ${license || 'Pexels License'}</p>
      `;
    } else if (mediaType === "audio") {
      console.log("Rendering default audio (Pexels does not support audio)");
      mediaItem.innerHTML = `
        <h3 class="media-title">Default Audio</h3>
        <p>Creator: Unknown</p>
        <p>License: ${license || 'Unknown'}</p>
        <audio controls class="media-content">
          <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg">
          Your browser does not support the audio element.
        </audio>
      `;
    } else if (mediaType === "videos" && item.video_files?.[0]?.link) {
      console.log("Rendering video:", item.video_files[0].link);
      mediaItem.innerHTML = `
        <h3 class="media-title">${item.alt || 'Untitled'}</h3>
        <p>Creator: ${item.user?.name || 'Unknown'}</p>
        <p>License: Pexels License</p>
        <video controls class="media-content" poster="${item.video_pictures?.[0]?.picture || 'https://placehold.co/300x200?text=Video+Thumbnail'}" onerror="this.poster='https://placehold.co/300x200?text=Video+Not+Found'; console.error('Failed to load video: ${item.video_files[0].link}');">
          <source src="${item.video_files[0].link}" type="video/mp4">
          Your browser does not support the video element.
        </video>
      `;
    } else {
      console.error("Media not available for item:", item);
      mediaItem.innerHTML = `<p class="error">Media not available</p>`;
    }

    resultsContainer.appendChild(mediaItem);
  });
}

// Function to save search history
async function saveSearchHistory(query, mediaType, license) {
  const currentUser = auth.currentUser;
  const searchData = { query, mediaType, license, timestamp: new Date() };

  // Save to localStorage
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

  // Save to Firestore in background
  addDoc(collection(db, "users", currentUser.uid, "searchHistory"), searchData)
    .then(() => {
      console.log("Saved search to Firestore for user:", currentUser.uid);
      loadRecentSearches(currentUser);
    })
    .catch((error) => {
      console.error("Error saving search to Firestore:", error);
      if (error.code === "permission-denied") {
        console.error("Check Firebase security rules for users/{userId}/searchHistory or authorized domains");
      }
    });
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
    console.error("No user logged in for recent searches, using cached searches");
    loadCachedSearches();
    return;
  }

  // Run Firestore query in background
  getDocs(collection(db, "users", currentUser.uid, "searchHistory"))
    .then((querySnapshot) => {
      const searches = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log("Found search:", data);
        searches.push({ id: doc.id, ...data });
      });

      if (searches.length > 0) {
        try {
          localStorage.setItem("recentSearches", JSON.stringify(searches.slice(0, 10)));
          console.log("Updated localStorage with Firestore searches");
          loadCachedSearches();
        } catch (error) {
          console.error("Error updating localStorage:", error);
        }
      }
    })
    .catch((error) => {
      console.error("Error loading recent searches:", error);
      let errorMessage = "Error loading recent searches: " + error.message;
      if (error.code === "unavailable" || error.message.includes("storage")) {
        errorMessage = "Unable to load recent searches due to browser privacy settings. Try disabling tracking prevention or using Chrome.";
      } else if (error.code === "permission-denied") {
        errorMessage = "Unable to load recent searches: Ensure 'kenny543151.github.io' is added to Firebase Authorized Domains.";
      }
      recentSearchesList.innerHTML = `<p class="error">${errorMessage}</p>`;
      loadCachedSearches();
    });
}

// Make functions available globally
window.searchMedia = searchMedia;
window.logoutUser = logoutUser;
window.deleteSearchHistory = deleteSearchHistory;
window.deleteCachedSearch = deleteCachedSearch;
