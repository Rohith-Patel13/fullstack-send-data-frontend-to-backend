const express = require("express");
const app=express();
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
app.use(express.json());

const { v4: uuid_generate_v4 } = require('uuid');

const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "userInfo.db");

let dbConnectionObject = null;

const initializeDBAndServer = async () => {
  try {
    dbConnectionObject = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(8383,()=>{
        console.log("server starts at 8383")
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

/*
Network Call to get HTML content as an HTTP Response:-

Sending file as an HTTP Response:-

Syntax:
response.sendFile(PATH, {root: __dirname });

PATH is a path to the file which we want to send.
__dirname is a variable in Common JS Modules that 
returns the path of the folder where the current 
JavaScript file is present.
*/
app.get("/",(requestObject,responseObject)=>{
  responseObject.sendFile("index.html",{root:__dirname})
});


// USER REGISTER
app.post("/insert", async (requestObject,responseObject)=>{
  const requestBody = requestObject.body;
  console.log(requestBody)
  const { name, email, password } = requestBody;
  const registerUsernameQuery = `SELECT * FROM user WHERE user_name='${name}';`;
  const dbResponse = await dbConnectionObject.get(registerUsernameQuery);
  if (dbResponse !== undefined) {
    responseObject.status(400);
    responseObject.send("User already exists");
  }
  if (dbResponse === undefined) {
    if (password.length < 6) {
      responseObject.status(400);
      responseObject.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const registerQuery = `INSERT INTO user(user_id,user_name, user_email, user_password)
       VALUES ('${uuid_generate_v4()}','${name}','${email}', '${hashedPassword}');`;
      await dbConnectionObject.run(registerQuery);
      responseObject.status(200);
      responseObject.send(requestBody);
    }
  }
});


//USER LOGIN 
app.post("/login", async (requestObject, responseObject) => {
  const requestBody = requestObject.body;
  const { name, password } = requestBody;
  const loginUsernameQuery = `SELECT * FROM user WHERE user_name='${name}';`;
  const dbResponse = await dbConnectionObject.get(loginUsernameQuery);
  if (dbResponse === undefined) {
    responseObject.status(400);
    responseObject.send("Invalid user");
  }
  if (dbResponse !== undefined) {
    const comparePassword = await bcrypt.compare(password, dbResponse.user_password);
    console.log(comparePassword);
    if (!comparePassword) {
      responseObject.status(400);
      responseObject.send("Invalid password");
    } else {
      const query = `SELECT * FROM user WHERE user_name='${name}';`;
      const dbRes = await dbConnectionObject.all(query);
      console.log(dbRes);

      const payload = {
        username: dbResponse.username,
        user_id: dbResponse.user_id,
      };
      const jwtCreatedToken = await jwt.sign(payload, "MY_SECRET_TOKEN_STRING");
      responseObject.send({
        jwtToken: jwtCreatedToken,
      });
    }
  }
});

//middleware to authenticate the JWT token:
const authenticateJwtToken = (requestObject, responseObject, next) => {
  /*
    example:
    let options = {
        method: requestMethodEl.value,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: "Bearer 956024779072d5b1668e3e20dce2bbd34377cccc9db7ff52e0b4a8a479c5cc7b"
        },
        body: requestBodyValue
    };
  */
    
  /*  
  console.log(requestObject.headers);
  {
  'user-agent': 'vscode-restclient',
  authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkpvZUJpZGVuIiwiaWF0IjoxNjkxNzMzNTkxfQ.pr-0VY1GVd5EpndR7ua3Ta1H7nrDOzZi-Ok1OqFmCU4',
  'accept-encoding': 'gzip, deflate',
  host: 'localhost:3001',
  connection: 'close'
  }
  */
  const authorizationValue = requestObject.headers.authorization;
  let tokenValue;
  if (authorizationValue !== undefined) {
    const authorizationArray = authorizationValue.split(" ");
    /*
    console.log(authorizationArray);
    [
  'Bearer',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkpvZUJpZGVuIiwiaWF0IjoxNjkxNzMzNTkxfQ.pr-0VY1GVd5EpndR7ua3Ta1H7nrDOzZi-Ok1OqFmCU4']
    */
    tokenValue = authorizationArray[1];
  }

  if (tokenValue === undefined) {
    responseObject.status(401);
    responseObject.send("Invalid JWT Token");
  } else {
    jwt.verify(tokenValue, "MY_SECRET_TOKEN_STRING", async (error, payload) => {
      if (error) {
        responseObject.status(401);
        responseObject.send("Invalid JWT Token");
      } else {
        console.log(payload);
       
        requestObject.username = payload.username;
        requestObject.user_id = payload.user_id;
        
        next();
      }
    });
  }
};


app.get(
  "/details",
  authenticateJwtToken,
  async (requestObject, responseObject) => {
    console.log("authentication completed successfully");
    //const requestQuery = requestObject.query;

    const { user_id } = requestObject;

    const tweetQuery = `SELECT * FROM user WHERE user_id='${user_id}';`;
    const dbResponse = await dbConnectionObject.all(tweetQuery);
    const dbResponseResult = dbResponse.map((eachObject) => ({
      username: eachObject.user_name,
      email: eachObject.user_email,
    }));

    responseObject.send(dbResponseResult);
  }
);

app.put(
  "/update",
  async (requestObject, responseObject) => {

    const {name,email}=requestObject.body;
    console.log(requestObject.body);
    
    const UsernameQuery = `SELECT * FROM user WHERE user_name='${name}';`;
    const dbResponse = await dbConnectionObject.get(UsernameQuery);
  
    if (dbResponse === undefined) {
      responseObject.status(400);
      responseObject.send("Invalid user");
    }else{
      const updateQuery=`UPDATE user SET user_email='${email}' WHERE user_name='${name}';`;
      await dbConnectionObject.run(updateQuery);
      responseObject.send("email Updated");
    }
    
  }
);


app.delete(
  "/delete",
  async (requestObject, responseObject) => {
    // console.log(requestObject)// query: { name: 'patel' }
    const {name} = requestObject.query;
    const UsernameQuery = `SELECT * FROM user WHERE user_name='${name}';`;
    const dbResponse = await dbConnectionObject.get(UsernameQuery);
  
    if (dbResponse === undefined) {
      responseObject.status(400);
      responseObject.send("Invalid user");
    }else{
      const deleteQuery = `DELETE FROM user WHERE user_name='${name}'`;
    
      await dbConnectionObject.run(deleteQuery);
      responseObject.send("User Removed");
    }
    
  }
);
