alert("AUTH JS BERHASIL DIMUAT");

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", function(event) {
        event.preventDefault();
        alert("TOMBOL LOGIN BERFUNGSI");
    });
}
