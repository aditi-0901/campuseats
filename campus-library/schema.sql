-- schema.sql -- Campus Library database (safe to run more than once)
CREATE DATABASE IF NOT EXISTS campus_library
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campus_library;

-- authors 1 --- many books
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

-- sample rows (INSERT IGNORE skips rows that already exist)
INSERT IGNORE INTO authors (id, name, country) VALUES
  (1, 'Meera Iyer',   'India'),
  (2, 'Arjun Desai',  'India'),
  (3, 'Lena Fischer', 'Germany');

INSERT IGNORE INTO books (id, title, year, author_id) VALUES
  (1, 'Relational Thinking',       2019, 1),
  (2, 'Indexes and Query Plans',   2021, 1),
  (3, 'Designing Web Services',    2023, 2);
-- Lena Fischer is left without books on purpose: it shows an empty shelf.
