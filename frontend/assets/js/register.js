document.getElementById("registerForm").addEventListener("submit", function(e) {
e.preventDefault();

let name = document.getElementById("name").value.trim();
let email = document.getElementById("email").value.trim();
let password = document.getElementById("password").value;

let message = document.getElementById("message");

// validation
if(password.length < 8){
    message.textContent = "Password must be at least 8 characters";
    return;
}

// get existing users
let users = JSON.parse(localStorage.getItem("users")) || [];

// check duplicate email
let exists = users.find(user => user.email === email);

if(exists){
    message.textContent = "Email already registered";
    return;
}

// save user
users.push({
    name: name,
    email: email,
    password: password
});

localStorage.setItem("users", JSON.stringify(users));

// success
message.style.color = "green";
message.textContent = "Registration successful! Redirecting...";

setTimeout(() => {
    window.location.href = "login.html";
}, 1500);

});