if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const GoogleStrategy = require("passport-google-oauth20").Strategy;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dbUrl = process.env.ATLASDB_URL;   // FIXED ENV VARIABLE
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const listingRouter = require("./routes/listing.js");
const reviewsRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const Listing = require("./models/listing.js");


//------------------------------------
// 1. DATABASE CONNECTION
//------------------------------------
async function main() {
  await mongoose.connect(dbUrl);
}
main()
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.log("DB Connection Error:", err));


//------------------------------------
// 2. VIEW ENGINE + MIDDLEWARE
//------------------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));


//------------------------------------
// 3. SESSION SETUP (WORKING)
//------------------------------------
const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: { secret: process.env.SECRET },
  touchAfter: 24 * 3600,
});
store.on("error", (e) => {
  console.log("Session Store Error:", e);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};

app.use(session(sessionOptions));
app.use(flash());


//------------------------------------
// 4. PASSPORT AUTH
//------------------------------------
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


//------------------------------------
// 5. GOOGLE OAUTH (UNCHANGED)
//------------------------------------
if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            let existingUser = await User.findOne({
              email: profile.emails[0].value,
            });

            if (existingUser) {
              existingUser.googleId = profile.id;
              existingUser.displayName = profile.displayName;
              await existingUser.save();
              return done(null, existingUser);
            }

            user = await User.create({
              googleId: profile.id,
              username: profile.emails[0].value,
              email: profile.emails[0].value,
              displayName: profile.displayName,
            });
          }

          return done(null, user);
        } catch (err) {
          console.error("Google OAuth error:", err);
          return done(err, null);
        }
      }
    )
  );
} else {
  console.log("Google OAuth not configured — skipping setup");
}


//------------------------------------
// 6. FLASH + GLOBAL VARIABLES (MOVED ABOVE ROUTES)
//------------------------------------
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currentUser = req.user;   // FIXES EJS ERROR
  next();
});


//------------------------------------
// ROUTES
//------------------------------------
app.get("/demouser", async (req, res) => {
  let fakeUser = new User({
    username: "demouser",
    email: "random@gmail.com",
  });

  let registeredUser = await User.register(fakeUser, "demouser");
  res.send(registeredUser);
});

app.get("/", (req, res) => {
  res.redirect("/listings");
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/", userRouter);


// GOOGLE AUTH ROUTES
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login", failureFlash: true }),
  (req, res) => {
    req.flash("success", "Successfully logged in with Google!");
    res.redirect("/listings");
  }
);


// SEARCH ROUTE
app.get("/search", async (req, res) => {
  const query = req.query.query;
  if (!query) return res.json([]);

  try {
    const regex = new RegExp(query, "i");
    const results = await Listing.find({
      $or: [{ title: regex }, { location: regex }, { country: regex }],
    })
      .limit(5)
      .select("title _id");

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});


//------------------------------------
// ERROR HANDLER
//------------------------------------
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("Error.ejs", { err });
});


//------------------------------------
// START SERVER (LAST)
//------------------------------------
app.listen(8080, () => {
  console.log("Server running on port 8080 (Render)");
});