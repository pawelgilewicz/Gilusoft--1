import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";
import nodemailer from "nodemailer";
// import { Pool } from "pg"

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false
//   }
// });

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

let date = new Date();



app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});
db.connect();


app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res,next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});


app.get("/default", async (req, res) => {
  console.log(req.user);
  
  if (req.isAuthenticated()) {
      try{
        const services = await db.query("SELECT * From Services")
        res.render("default.ejs",{services:services.rows,date:date});
      }catch(err)
      {
        res.render("default.ejs" ,{date:date});
      }
       
        
     
    
  } else {
    res.redirect("/login");
  }
});

// ////////////////SUBMIT GET ROUTE/////////////////
// app.get("/submit", function (req, res) {
//   if (req.isAuthenticated()) {
//   res.render("submit.ejs");
//   } else {
//     res.redirect("/login");
//   }
// });

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/gilusoft",
  passport.authenticate("google", {
    successRedirect: "/default",
    failureRedirect: "/login",
  })
);

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/default",
    failureRedirect: "/login",
  })
);
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,        
    pass: process.env.EMAIL_PASSWORD,   
  },
});

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/default");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});




passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/gilusoft",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [profile.email, "google"]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});



//comment

// 

app.get("/comments", async (req, res) => {
  try {
    const result = await db.query(`
        SELECT 
            c.post_id,
            c.title,
            c.content,
            c.rating,
            u.email AS author_name 
        FROM comments c
        JOIN users u ON c.user_id = u.id
        ORDER BY c.post_id DESC
    `);

    res.render("comments.ejs", { listaKomentarzy: result.rows });

  } catch (err) {
    console.log(err);
    res.status(500).send("Błąd ładowania komentarzy");
  }
});


app.get("/addComment",(req,res)=>
{
res.render("addComment.ejs");
})


app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;

  const mailOptions = {
    from: process.env.EMAIL_USER, 
    to: process.env.EMAIL_USER, 
    subject: `New Contact Form Message from ${name}`,
    text: `You received a new message:\n\nFrom: ${name} (${email})\n\nMessage:\n${message}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.redirect("/default");
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).send("Failed to send message.");
  }
});


app.get("/contact", (req, res) => {
  res.render("contact.ejs");
});


app.post("/addcomment", async (req, res) => {
  
  if (req.isAuthenticated()) {
    const { title, content, rating } = req.body;
    const userId = req.user.id; 
    const currentDate = new Date().toISOString().split('T')[0]; 

    try {
      await db.query(
        "INSERT INTO comments (user_id, title, content, rating, date) VALUES ($1, $2, $3, $4, $5)",
        [userId, title, content, parseInt(rating), currentDate]
      );
      
      
      res.redirect("/comments");
    } catch (err) {
      console.error("Error inserting comment:", err);
      res.status(500).send("Failed to submit comment.");
    }
  } else {
    
    res.redirect("/login");
  }
});
