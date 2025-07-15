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

// Function to log out user
export function logoutUser() {
  signOut(auth)
    .then(() => {
      console.log("User logged out successfully");
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
  if (!user) {
    console.log("No user logged in, redirecting to login");
    window.location.href = "login.html";
  } else {
    // Wait for auth to settle, then load searches
    console.log("User authenticated:", user.uid);
    setTimeout(() => loadRecentSearches(user), 1500); // Increased delay for stability
  }
});

// Function to search for media
export async function searchMedia() {
  const searchInput = document.getElementById("searchInput").value.trim();
  const selectedMediaType = document.getElementById("mediaType").value;
  const selectedLicense = document.getElementById("licenseType").value;
  const resultsContainer = document.getElementById("resultsContainer");
  const loadingIndicator = document.getElementById("loadingText");

  // Clear previous results
  resultsContainer.innerHTML = "";
  if (!searchInput) {
    alert("Please enter a search term.");
    return;
  }

  // Show loading message
  loadingIndicator.style.display = "block";

  try {
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
    console.log("Openverse API response:", data); // Log API response for debugging

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
        console.log("Rendering image:", item.url); // Log image URL
        mediaItem.innerHTML = `
          <img src="${item.url}" alt="${item.title || 'Image'}" style="width: 100%; border-radius: 8px;" onerror="this.src='https://via.placeholder.com/150?text=Image+Not+Found'; this.alt='Image not available'; console.error('Failed to load image: ${item.url}');">
          <h3 class="media-title">${item.title || 'Untitled'}</h3>
          <p>Creator: ${item.creator || 'Unknown'}</p>
          <p>License: ${item.license || 'Unknown'}</p>
        `;
      } else if (selectedMediaType === "audio" && item.url) {
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
        mediaItem.innerHTML = `<p>Media not available</p>`;
      }

      resultsContainer.appendChild(mediaItem);
    });

    // Save search to history
    await saveSearchHistory(searchInput, selectedMediaType, selectedLicense);

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
  if (!currentUser) {
    console.error("No user logged in, cannot save search");
    return;
  }

  try {
    await addDoc(collection(db, "users", currentUser.uid, "searchHistory"), {
      query,
      mediaType,
      license,
      timestamp: new Date()
    });
    console.log("Saved search for user:", currentUser.uid);
    loadRecentSearches(currentUser);
  } catch (error) {
    console.error("Error saving search:", error);
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
  // Use passed user or current user
  const currentUser = user || auth.currentUser;
  if (!currentUser) {
    console.error("No user logged in for recent searches, redirecting to login");
    window.location.href = "login.html";
    return;
  }

  const recentSearchesList = document.getElementById("recentSearches");
  recentSearchesList.innerHTML = "<p>Loading recent searches...</p>";

  try {
    console.log("Fetching recent searches for user:", currentUser.uid);
    const searchHistoryRef = collection(db, "users", currentUser.uid, "searchHistory");
    const querySnapshot = await getDocs(searchHistoryRef);

    // Clear loading message
    recentSearchesList.innerHTML = "";

    // Check if no searches exist
    if (querySnapshot.empty) {
      console.log("No recent searches found for user:", currentUser.uid);
      recentSearchesList.innerHTML = "<p>No recent searches yet.</p>";
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
      errorMessage = "Unable to load recent searches due to browser privacy settings. Try disabling tracking prevention or using another browser.";
    } else if (error.code === "permission-denied") {
      errorMessage = "Unable to load recent searches: Check Firebase security rules or ensure 'kenny543151.github.io' is added to Authorized Domains in Firebase Console.";
    } else if (error.code === "failed-precondition") {
      errorMessage = "Unable to load recent searches: Ensure Firestore is enabled and the database is accessible.";
    }
    recentSearchesList.innerHTML = `<p style="color:red;">${errorMessage}</p>`;
  }
}

// Make functions available globally
window.searchMedia = searchMedia;
window.logoutUser = logoutUser;
window.deleteSearchHistory = deleteSearchHistory;
