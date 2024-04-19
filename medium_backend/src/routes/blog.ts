import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { verify } from "hono/jwt";
import { createBlogInput, updateBlogInput } from "@hardikshah343/medium_common";

export const blogRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  },
  Variables: {
    userId: string;
  }
}>();

blogRouter.use("/*", async (c, next) => {
  /* Extract the user Id and pass it down to the route handler */
  const authHeader = c.req.header("authorization") || ""; /* Default to empty string */
  const user = await verify(authHeader, c.env.JWT_SECRET);

  try {
    if (user) {
      c.set("userId", user.id);
      console.log("Verified");
      await next();
    } else {
      c.status(403);
      return c.json({
        message: "You are not logged in"
      });
    }
  } catch (e) {
    c.status(403);
    return c.json({
      message: "You are not logged in"
    });
  }
});

blogRouter.post("/", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  const body = await c.req.json();
  const { success } = createBlogInput.safeParse(body);
  if (!success) {
    c.status(411);
    return c.text("All parameters not present or in invalid format");
  }

  const userId = c.get("userId");
  const blog = await prisma.blog.create({
    data: {
      title: body.title,
      content: body.content,
      authorId: userId,
    },
  });

  return c.json({
    id: blog.id,
  });
});

blogRouter.put("/", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  const body = await c.req.json();
  const { success } = updateBlogInput.safeParse(body);
  if (!success) {
    c.status(411);
    return c.text("All parameters not present or in invalid format");
  }
  try {
    const blog = await prisma.blog.update({
      where: {
        id: body.id,
      },
      data: {
        title: body.title,
        content: body.content,
      }
    });
    return c.json({
      id: blog.id
    })
  } catch (e) {
    console.log(e);
    c.status(411);
    return c.text("Unable to update, something went wrong.");
  }
});

blogRouter.get("/bulk", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,    
  }).$extends(withAccelerate());

  /* Add pagination i.e. load more on scrolling */
  const blogs = await prisma.blog.findMany({
    select: {
      content: true,
      title: true,
      id: true,
      author: {
        select: {
          name: true
        }
      }
    }
  }); /* No condition so all blocks */

  return c.json({
    blogs
  });
});

blogRouter.get("/:id", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,    
  }).$extends(withAccelerate());

  const id = c.req.param("id");
  try {
    const blog = await prisma.blog.findFirst({
      where: {
        id: id
      },
      select: {
        title: true,
        id: true,
        content: true,
        author: {
          select: {
            name: true
          }
        }
      }
    })

    return c.json({
      blog
    });
  } catch(e) {
    console.log(e);
    c.status(411);
    return c.text("Error while fetching blog post");
  }
});


