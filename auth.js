document.addEventListener("DOMContentLoaded", function () {
    // Check if Firebase Auth is initialized
    if (!window.firebaseAuth) {
        console.error("Firebase Auth not initialized!");
        return;
    }

    console.log("Firebase Auth loaded successfully.");

    const loginBtn = document.getElementById("loginBtn");
    const signUpBtn = document.getElementById("signUpBtn");

    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            if (!email || !password) {
                alert("Please enter email and password.");
                return;
            }

            try {
                await window.firebaseAuth.signInWithEmailAndPassword(email, password);
                alert("Login successful!");
                window.location.href = "search.html";
            } catch (error) {
                alert("Error: " + error.message);
            }
        });
    }

    if (signUpBtn) {
        signUpBtn.addEventListener("click", async () => {
            const email = document.getElementById("signupEmail").value;
            const password = document.getElementById("signupPassword").value;

            if (!email || !password) {
                alert("Please enter email and password.");
                return;
            }

            try {
                await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
                alert("Account created successfully!");
                window.location.href = "search.html";
            } catch (error) {
                alert("Error: " + error.message);
            }
        });
    }

    window.firebaseAuth.onAuthStateChanged((user) => {
        if (!user && !window.location.pathname.includes("login.html") && !window.location.pathname.includes("signup.html")) {
            window.location.href = "login.html";
        }
    });
});
document.addEventListener("DOMContentLoaded", function () {
    // Check if Firebase Auth is initialized
    if (!window.firebaseAuth) {
        console.error("Firebase Auth not initialized!");
        return;
    }

    console.log("Firebase Auth loaded successfully.");

    const signUpBtn = document.getElementById("signUpBtn");

    if (signUpBtn) {
        signUpBtn.addEventListener("click", async () => {
            const email = document.getElementById("signupEmail").value;
            const password = document.getElementById("signupPassword").value;

            if (!email || !password) {
                alert("Please enter email and password.");
                return;
            }

            try {
                const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
                console.log("User signed up:", userCredential.user);

                alert("Account created successfully! Redirecting...");
                setTimeout(() => {
                    window.location.href = "search.html";
                }, 1000); // Small delay to allow Firebase to process
            } catch (error) {
                alert("Error: " + error.message);
                console.error(error);
            }
        });
    }

    // Ensure the user is redirected if already logged in
    window.firebaseAuth.onAuthStateChanged((user) => {
        if (user) {
            console.log("User is logged in:", user);
            if (window.location.pathname.includes("signup.html") || window.location.pathname.includes("login.html")) {
                window.location.href = "search.html";
            }
        }
    });
});

