-- schema.sql -- CampusEats Catalogue database (MySQL)
-- Tables and column names follow Assignment 2 (Task 5): outlets 1 --- many menu_items

-- 1. create the database
CREATE DATABASE IF NOT EXISTS campuseats;
USE campuseats;

-- 2. create the two tables
CREATE TABLE IF NOT EXISTS outlets (
    outlet_id  INT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    address    VARCHAR(255) NOT NULL,
    phone      VARCHAR(20),
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
    menu_item_id INT PRIMARY KEY AUTO_INCREMENT,
    outlet_id    INT NOT NULL,
    name         VARCHAR(100) NOT NULL,
    description  VARCHAR(255),
    price        DECIMAL(10,2) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (outlet_id) REFERENCES outlets(outlet_id)
);

-- 3. sample rows (run this file once; running it again would duplicate them)
INSERT INTO outlets (name, address, phone) VALUES
('Main Canteen', 'Ground Floor, Academic Block', '0265-0000001'),
('Tapri Corner', 'Near Hostel Gate', '0265-0000002');

INSERT INTO menu_items (outlet_id, name, description, price, is_available) VALUES
(1, 'Veg Sandwich', 'Grilled, with chutney', 40.00, TRUE),
(1, 'Masala Dosa', 'With sambar and chutney', 60.00, TRUE),
(2, 'Cutting Chai', 'Half glass', 10.00, TRUE),
(2, 'Samosa', 'Two pieces', 20.00, FALSE);
