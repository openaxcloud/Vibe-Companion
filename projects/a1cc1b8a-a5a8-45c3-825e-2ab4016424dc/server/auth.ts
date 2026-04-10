// filename: server/auth.ts
   import passport from 'passport';
   import { Strategy as LocalStrategy } from 'passport-local';
   import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
   import { Strategy as GitHubStrategy } from 'passport-github';
   import { findUserByEmail, findUserById, createUser } from './user-service';

   passport.use(new LocalStrategy(
     async (username, password, done) => {
       const user = await findUserByEmail(username);
       if (!user || !user.validatePassword(password)) {
         return done(null, false, { message: 'Incorrect email or password.' });
       }
       return done(null, user);
     }
   ));

   passport.use(new GoogleStrategy({
     clientID: process.env.GOOGLE_CLIENT_ID,
     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
     callbackURL: "/auth/google/callback"
   },
   async (accessToken, refreshToken, profile, done) => {
     let user = await findUserByEmail(profile.emails[0].value);
     if (!user) {
       user = await createUser({ email: profile.emails[0].value, googleId: profile.id });
     }
     return done(null, user);
   }));

   passport.use(new GitHubStrategy({
     clientID: process.env.GITHUB_CLIENT_ID,
     clientSecret: process.env.GITHUB_CLIENT_SECRET,
     callbackURL: "/auth/github/callback"
   },
   async (accessToken, refreshToken, profile, done) => {
     let user = await findUserByEmail(profile.emails[0].value);
     if (!user) {
       user = await createUser({ email: profile.emails[0].value, githubId: profile.id });
     }
     return done(null, user);
   }));

   passport.serializeUser((user, done) => {
     done(null, user.id);
   });

   passport.deserializeUser(async (id, done) => {
     const user = await findUserById(id);
     done(null, user);
   });