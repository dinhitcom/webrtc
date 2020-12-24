const PORT = 3000;
let express = require('express');
let app = express();
//let http = require('http');
let server = app.listen(PORT);
let io = require('socket.io')(server);
let path = require("path");
let cookieParser = require("cookie-parser");
let indexRouter = require("./routes/index");


app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

//app.use(express.json());
//app.use(express.urlencoded({ extended: false }));
//app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);

// app.listen(PORT, () => {
//     console.log(`Server started at PORT ${PORT}`);
// })
module.exports = app;