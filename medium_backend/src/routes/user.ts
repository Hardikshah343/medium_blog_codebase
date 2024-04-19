import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { sign } from "hono/jwt";
import { signinInput, signupInput } from "@hardikshah343/medium_common";

export const userRouter = new Hono<{
    Bindings: {
      DATABASE_URL: string;
      JWT_SECRET: string;
    };
  }>();


userRouter.post("/signup", async (c) => {  
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    
    const body = await c.req.json();  
    const { success } = signupInput.safeParse(body);

    if (!success) {
      c.status(411);
      return c.text("All parameters not present or in incorrect format");
    }

    try {
      /* Need to add: Zod Validation and Hashed password */
      /* If user is already present the create will fail and throw a error */
      const user = await prisma.user.create({
        data: {
          email: body.email,
          password: body.password,
          name: body.name,
        },
      });
  
      const jwt = await sign({
        id: user.id
      }, c.env.JWT_SECRET)
  
      return c.text(jwt);
  
    } catch (e) {
      c.status(411);
      return c.text("Invalid: Might be user already exists with this email");
    }
  });
  
  userRouter.post("/signin", async (c) => {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
  
    const body = await c.req.json();
    const { success } = signinInput.safeParse(body);

    if (!success) {
      c.status(411);
      return c.text("All parameters not present or in incorrect format");
    }
    try {
      const user = await prisma.user.findFirst({
        where: {
          email: body.email,
          password: body.password
        }
      });
  
      if (!user) { /* User not found */
        c.status(403);  /* Unauthorized access */
        return c.text("Incorrect email or password");
      }
      const jwt = await sign({
          id: user.id
        }, c.env.JWT_SECRET);
      
      return c.text(jwt)
    } catch (e) {
      console.log(e);
      c.status(411);
      return c.text("Something went wrong while signing in");
    }
  });