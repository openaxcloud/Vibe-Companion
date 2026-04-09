// filename: server/index.ts
   import session from 'express-session';
   import connectPgSimple from 'connect-pg-simple';

   const pgSession = connectPgSimple(session);

   app.use(session({
     store: new pgSession({
       conString: process.env.DATABASE_URL
     }),
     secret: process.env.SESSION_SECRET,
     resave: false,
     saveUninitialized: false,
     cookie: { secure: process.env.NODE_ENV === 'production' }
   }));

   app.use(passport.initialize());
   app.use(passport.session());