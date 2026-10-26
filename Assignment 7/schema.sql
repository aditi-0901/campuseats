-- schema.sql -- CampusEats Menu (Catalogue Service) for the GraphQL assignment.
--
-- This is the `menu_items` table from Assignment 2 (Task 5), kept to the fields
-- this assignment needs: outlet_id and description are left out so the demo
-- stays one table. Re-running this file RESETS the demo data (the table is
-- dropped and recreated), which is what you want before a "before" screenshot.
--
--   mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS campuseats_graphql
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campuseats_graphql;

DROP TABLE IF EXISTS menu_items;

CREATE TABLE menu_items (
  menu_item_id INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100)  NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  is_available BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_menu_items_price CHECK (price >= 0)
);

-- Seed rows. "Paneer Roll" is deliberately NOT here: it is the dish the
-- demo adds live through the addDish mutation.
INSERT INTO menu_items (name, price, is_available) VALUES
  ('Masala Dosa',     80.00, TRUE),
  ('Veg Sandwich',    60.00, TRUE),
  ('Samosa (2 pcs)',  30.00, TRUE),
  ('Cold Coffee',     50.00, FALSE);   -- sold out, so the page shows both states
