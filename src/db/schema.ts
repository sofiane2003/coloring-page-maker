import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** The app's own record of each member, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** One generated coloring page. Its image is in R2 under `imageKey`. */
export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    ageLevel: text("age_level").notNull(),
    shape: text("shape").notNull(),
    imageKey: text("image_key").notNull(),
    /** Set while the page is in the organization's gallery. */
    theme: text("theme"),
    publishedAt: integer("published_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("pages_user_created").on(table.userId, table.createdAt),
    index("pages_published").on(table.publishedAt),
  ],
);

/** Generations per member per UTC day, kept when pages are deleted. */
export const dailyUsage = sqliteTable(
  "daily_usage",
  {
    userId: text("user_id").notNull(),
    day: text("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })],
);
