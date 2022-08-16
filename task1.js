var express = require("express");
var session = require("express-session");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var ejs = require("ejs");

var {readFileUtil} = require("./model/fileUtil");
var {writeFileUtil } = require("./model/fileUtil");
var {randomChoice} = require("./taskec");

const app = express();

//referenced from https://github.com/kgary/ser421public
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
	secret: 'MAGICALEXPRESSKEY',
	resave: true,
	saveUninitialized: true
}));
app.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0"
  );
  next();
});

//TASK 2
app.set("view engine", "ejs");
app.engine("html", ejs.renderFile);

//handle GET routes
app.get("/", (req, res) => {
  res.redirect("/landing");
});

app.get("/landing", (req, res) => {
  var uname = req.session.uname;
  if(uname === undefined) {
    uname = req.cookies.unameCookie;
  }
  displayPageUtil(
    "landing",
    {
      uname: uname,
    },
    res
  );
});

app.get("/layoutSetting", (req, res) => {
  displayPageUtil(
    "settings",
    {
      preference: req.cookies.setLayoutStyle,
    },
    res
  );
});

//handle POST routes
app.post("/setLayout", (req, res) => {
  res.cookie("setLayoutStyle", req.body.preference);
  res.redirect(307, "/survey");
});

app.post("/survey", async (req, res) => {
  try {
    let btn = req.body.submit;
    if (btn === undefined) {
      await init(req, res);
    } else {
      updateQuestionNum(req,btn);
    }
    displaySurveyPage(req, res);
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

app.post("/match", async (req, res) => {
  req.session.uname = req.body.uname;
  res.cookie("unameCookie", req.body.uname, new Date());
  var userData = await parseUserData();
  displayPageUtil(
    "surveymatch",
    {
      uname: req.session.uname,
      users: surveyMatches(req.session.uname, userData.usersList),
    },
    res
  );
});

//init session and variables
async function init(req, res) {
  req.session.uname = req.body.uname;
  res.cookie("unameCookie", req.body.uname, new Date());
  var userJson = await readFileUtil("./db/survey.json");
  if (userJson === "") {
    req.session.questions = [];
  } else {
    var userData = JSON.parse(userJson);
    req.session.questions = userData["questions"];
    req.session.currQuesId = 0;
    req.session.totalIa = 0;
    req.session.userChoices = await userReponses(req);
  }
}

//TASK 1
function displaySurveyPage(req, res) {
  var pageNum = req.session.currQuesId;
  var session = req.session;
  if (session.questions.length === 0) {
    res.send("Empty/Corrupted survey.json");
    return;
  }
  else if(session.questions.length === session.currQuesId){
    destroy(req);
    displayPageUtil(
      "finished", 
      {
        iaChoices: req.session.totalIa,
      }, 
      res);
  } else {
    session.randCh = randomChoice(session.questions[pageNum].choices.length)
    displayPageUtil(
      "survey",
      {
        uname: req.session.uname,
        page: pageNum + 1,
        question: session.questions[pageNum].question,
        choices: session.questions[pageNum].choices,
        rand: session.randCh,
        selected: getChoice(session, pageNum),
        layoutStyle: req.cookies.setLayoutStyle,
      },
      res
    );
  }
}

function displayPageUtil(userJson, options, res) {
  app.render(userJson, options, (err, renderedData) => {
    if (err) {
      console.error(err);
      res.send("500: Internal Server Error");
    } else {
      res.send(renderedData);
    }
  });
}

function surveyMatches(uname, usersList) {
  var users = {};
  var hm = new Map();

  if (usersList[uname] !== undefined) {
    for (let ques in usersList[uname]) {
      hm.set(ques, usersList[uname][ques]);
    }
  }

  for (let user in usersList) {
    let ctr = 0;
    for (let ques in usersList[user]) {
      if (
        user !== uname &&
        hm.has(ques) &&
        hm.get(ques) === usersList[user][ques]
      ) {
        ctr++;
      }
    }
    if (user !== uname) users[user] = ctr;
  }

  return Object.entries(users)
    .sort(([, a], [, b]) => b - a)
    .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});
}

async function userReponses(req) {
  var uname = req.session.uname;
  var userData = await parseUserData();
  var userChoices = userData.usersList[uname];
  return userChoices !== undefined ? userChoices : {};
}

async function parseUserData() {
  var userJson = "./db/users.json";
  var userData = await readFileUtil(userJson);
  return JSON.parse(userData);
}

function updateQuestionNum(req, option) {
  var quesId = req.session.questions[req.session.currQuesId].id;
  req.session.userChoices[quesId] = req.body.answer;
  if(option === "next"){
    req.session.currQuesId++;
  } else if(option === "prev"){
    req.session.currQuesId--;
  }

  if(quesId === req.session.randCh) {
    req.session.totalIa++;
  }
}

function getChoice(session, index) {
  var quesId = session.questions[index].id;
  return session.userChoices[quesId] === undefined
    ? ""
    : parseInt(session.userChoices[quesId]);
}

async function destroy(req) {
  var uname = req.session.uname;
  var userJson = "./db/users.json";
  var userData = await parseUserData();
  userData.usersList[uname] = req.session.userChoices;
  writeFileUtil(userJson, userData);
  req.session.destroy();
}

app.all("*", (req, res, next) => {
  res.status(404);
  res.send("404: Page Not Found");
});


app.use((err, req, res, next) => {
  console.error(err);
  res.status(500);
  res.send("500: Internal Server Error");
});

app.listen(3000);
