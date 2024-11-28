const main = document.getElementById("main");

const formHTML = `
    <form id="form">
        <input type="text">
        <input type="submit">
    </form>
`;

main.insertAdjacentHTML("afterend", formHTML);

const form = document.getElementById("form");
form.addEventListener("submit", onSubmit);

function onSubmit(event) {
    console.log(event.target.querySelector("input[type='text']"));
    event.preventDefault();

}