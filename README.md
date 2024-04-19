# Medium - The blogging website

We are creating the medium website for blogging.
Following the steps to create the medium website.

## Backend
Lets first setup backend.

### 1. Initialise the hono worker.

Setting up the workspace. 
```terminal
$ npm create hono@latest
> name of the app ? <app-name>
> deploying to ? cloudworkers
> package manager ? npm
```
So we used `backend` as app-name.

### 2. Setting up postgresql

For data base, setting up `Aiven` postgres server.
Just create a account and setup a data base to get the database url.

Now lets say the urls as `aiven-url` for direct link to aiven postgres database.

### 3. Connection-pool url

When using the cloudflare workers, which can be deployed anywhere the more traffic is comming from. There can be multiple workers aligned to serve the requests, but the postgresql url can be allocated to only max 2 workers because of multiple reasons. 

Now in order to allow workers to connect to the database, we should use a single point lets say `x` which every worker will request to for database requests. And `x` will communicate with the database and respond to each worker. 

So our `x` is just a connection pool and for which we will use `prisma accelarate`.

Now login to `Prisma data platform` and enable or use `prisma accelerate`.
Copy the `aiven-url` and create a api key from `prisma accelerate`.

Now this will give you, lets call it `acc_api key`.

### 4. Setting up prisma
Make sure you are in `backend` folder.
```terminal
$ npm i prisma
$ npx prisma init
```

Now this will create a prisma file called `schema.prisma` which has all the info required for migrating the database.
1. `datasource db`: basically location or url of database.
Now we can directly put the database url (`aiven-url`) to this variable. But this file will be uploaded to git so it will expose the database. Hence we use environment variables for the same.
Go to `.env` file and add the url
`DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"`
And set the provider to `postgresql` as we are using a postgress sql for the website.

**Note: We have two URLs for DB connection, ie. `aiven-url` and `acc_api key`. And we have two kind of users ie. prisma to migrate or update the schema of db and our hono routes or workers that will access the database. So prisma should be given the direct access to the database and will use `aiven-url` and for workers they will use the connection pool so the will be given `acc_api key`. So for prisma put the `aiven-url` to `.env` and for workers we will use `wrangler.toml` file.**
We run migrate prisma only once, so no issue to put actual db url. Also prisma migrate dont support accelerate url.

2. Also update the `wrangler.toml` file as we have the accelerate url. (`acc_api key`)
Uncomment the `[vars]` and add the database url without the space
Example
```toml
[vars]
DATABASE_URL="acc_api key"
```

### 5. Initialze the schema and Migrate 
Now lets create the database tables so that we can store data in the format.
Inside `schema.prisma` file just add the models we need for the website and the relations if any.

Now to migrate 
`$ npx prisma migrate dev --name init_schema`
or (if it fails)
`$ npx prisma db push`

Here --name is just the description for the migration
Now prisma creates `migration.sql` file check it out, it has all the queries for creating all the tables with all references.

Now whenever we update the model and migrate, prisma will create queries based on it when we migrate and run the queries on DB.


### 6. Generate the Prisma client
This step creates some dependencies or files that will be used in the routes to manage the database safely.
`$ npx prisma generate --no-engine`

* Normally we dont add `--no-engine` to the command, because we deploying to local, docker or maybe a proper aws rented system. But here we are working with cloudflare workers. Cloudflare workers use their own engine or code which makes it light weight and doesnt allow us to use express. 
* Now this step also creates kind of types and interfaces for us to use in typescript that restricts us from putting invalid or inconsistent data in the database.
* Also gives use simplicity while adding data to DB. eg, `User.add({ data: {...} })` will add the data to database.

Note: The client is generated inside the node modules ie. `./node_modules/@prisma/client`
And this client is what we use to create code like `User.update({ data: {...} })`, because it knows user is a model or a table in database and also knows the attributes.

(optional) If you want to update or install client to latest code run the command.
`$ npm install @prisma/client@latest`

**Then install accelerate extension**
`$ npm install @prisma/extension-accelerate`

**Initialise the prisma client**
```ts
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate'

const prisma = new PrismaClient({
    datasourceUrl: env.DATABASE_URL,
}).$extends(withAccelerate());
```
Now in typescript one thing to note here, typescript does not know about the DATABASE_URL env variable, it will be injected in runtime. So it also does not know the type of DATABASE_URL so we have to explicitly tell ts that this is of lets say string type then TS will not complain even if the DATABASE_URL is not present in env variable.
So being a developer make sure that DATABASE_URL is present in `wrangler.toml` file for it to access.
```ts 
const app = new Hono<{
  Bindings: {
    DATABASE_URL: string;
  }
}>();
```
This is how we tell TS that DATABASE_URL wherever used is of type string dont worry it will be injected at runtime.

### 7. Authentication using JWT
Now we are not using the JWT available for express, because we are deploying to cloudflare workers which does not support the JWT library.
So here we can use a library provided by Hono.

` import { decode, sign, verify } from 'hono/jwt';`

For maintaining the secret we can directly Hard-code the secret or use the `wrangler.toml` file to maintain the secret.
Under  `[vars]` just add the variable.

### 8. Routing for cleaner code base


### 9. Middleware for all requests
This step whatever get put or post request comes from a user must be authenticated before processing the request. Basically JWT authentication is required.

[Backend -> FrontEnd]
Users login or signup request received, backend will send a JWT token.

[Frontend -> Backend]
While creating or updating, user will send a token `"Bearer [token]"` under `authorization` in header. So backend will verify the token and then process the request else respond with invalid request.

This is how authentication is done here.

### 10. Adding ZOD validation
1. Install zod and import zod.
`$ npm i zod`
Import zod
`import z from "zod";`
And define the structure we expect from front end.

2. Using runtime zod variables.
Using type inference in Zod, we have applied zod validation.
We get types from `runtime zod variables` that we will use in frontend.

3. Now when we write front end code it should ideally not refer runtimes from backend code.
Hence we seperate out or modify the whole project into module
1. Backend module (cloudflare)
2. Frontend module (react)
3. Common module [export zod, variables, types]

This common module we can deploy to npm and then install using npm install, and use these that way.
(kindof dependencies)

So we use `import { zodStructure } from "@hardikshah343/medium_common"`
We deploy npm package to `@hardikshah343/medium_common`

**Note: We can do it using monorepos. But for now we will use npm packages.**

4. Install `@hardikshah343/medium_common` using
`$ npm i @hardikshah343/medium_common`


### 11. Deploying the backend
1. Login to wrangler (ie. to cloudflare account)
`$ npx wrangler login`
2. Run command to deploy
`$ npm run deploy` or `$ wrangler run deploy`



## Common
The npm module or package that we deploy to NPM

### 1. Initialise NPM
1. Initialise the workspace
```terminal
$ npm init -y
$ npx tsc --init
```
2. Go to `tsconfig.json` and update following
* `rootDir` to './src'
* `outDir` to './dist'
* `declarations` to 'true' (ie. when we deploy code to NPM, along with JS code we should also upload `.d.ts` file which is created by typescript for us when we enable this flag)

3. Create `src` folder and initalise with `index.tsc`

### 2. Create the zod validations

### 3. Deploy common to global NPM repository
* As code is in `./src/index.ts` typescript, convert to js
* `$ tsc -b`
* Change the main under package.json to `./dist/index.js`
* `$ npm login`  -> login to NPM repository
* `$ npm publish --access public`
* Add `.npmignore` in which we add src

Now we can use these types and structures in backend and frontend.



## Front End

### 1. Create the workspace
1. Initialise the workspace
```terminal
$ npm create vite@latest
Project name: Medium_frontend
Framework: React
Variant: Typescript
$ cd Medium_frontend
$ npm install
```

2. Install tailwind CSS
```terminal
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

3. Update the content of `tailwind.config.js` to 
```config
 content: [
    "./index.html",
    "./src/**/*.{js, ts, jsx, tsx}",
  ],
```
so tailwind knows where to find all the files.

4. Update `index.css` to 
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

5. Install the common package from NPM
`$ npm i @hardikshah343/medium_common`

6. Try `$ npm run dev`


### 2. Add routing
1. Install react router dom
`$ npm i react-router-dom`

2. 














TODO:
1. Add pagination: Update posts on scrolling, do not return all at once.
2. Hashing the password before sending to backend.


