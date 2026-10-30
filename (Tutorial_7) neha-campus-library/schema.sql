-- schema.sql -- Neha's Campus Library database
-- Safe to run repeatedly; INSERT IGNORE avoids duplicating the sample rows.
CREATE DATABASE IF NOT EXISTS neha_library
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE neha_library;

-- One author can have many books.
CREATE TABLE IF NOT EXISTS authors (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  name    VARCHAR(100) NOT NULL,
  country VARCHAR(50),
  UNIQUE KEY uq_author_name (name)
);

CREATE TABLE IF NOT EXISTS books (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  title     VARCHAR(200) NOT NULL,
  year      INT,
  author_id INT NOT NULL,
  CONSTRAINT fk_books_author FOREIGN KEY (author_id) REFERENCES authors(id),
  CONSTRAINT chk_books_year CHECK (year IS NULL OR year BETWEEN 1000 AND 2100),
  UNIQUE KEY uq_author_title (author_id, title),
  INDEX idx_books_year (year)
);

-- Customized sample authors
INSERT IGNORE INTO authors (id, name, country) VALUES
  (1, 'Ananya Sharma', 'India'),
  (2, 'Kabir Verma',   'India'),
  (3, 'Mira Sen',      'India');

-- Customized sample books; Mira Sen intentionally starts with an empty shelf.
INSERT IGNORE INTO books (id, title, year, author_id) VALUES
  (1, 'Foundations of Computing', 2021, 1),
  (2, 'Learning SQL Step by Step', 2023, 1),
  (3, 'Web Services in Practice', 2024, 2);
