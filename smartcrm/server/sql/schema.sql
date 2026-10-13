CREATE DATABASE IF NOT EXISTS smartcrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smartcrm;

-- WARNING: running this file resets all data
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS sync_log;
DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  woo_id BIGINT UNSIGNED NULL UNIQUE,            -- WooCommerce customer id (prevents duplicate imports)
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,            -- also prevents duplicate customers
  phone VARCHAR(25) NULL,
  address VARCHAR(255) NULL,
  source ENUM('manual','demo','woocommerce') NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  woo_id BIGINT UNSIGNED NULL UNIQUE,            -- WooCommerce order id (prevents duplicate imports)
  customer_id INT UNSIGNED NOT NULL,
  order_number VARCHAR(30) NOT NULL DEFAULT '',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, on-hold, completed, cancelled, refunded, failed
  item_summary VARCHAR(500) NULL,
  order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source ENUM('manual','demo','woocommerce') NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orders_customer (customer_id),
  INDEX idx_orders_status (status),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  order_id INT UNSIGNED NULL,
  subject VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  status ENUM('Pending','Completed','Failed') NOT NULL DEFAULT 'Pending',
  -- saved = only stored in database, simulated = demo "send" (NO email left the server), sent = real email delivered
  delivery ENUM('saved','simulated','sent') NOT NULL DEFAULT 'saved',
  error_message VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  INDEX idx_messages_status (status),
  CONSTRAINT fk_messages_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE sync_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sync_type ENUM('demo','live') NOT NULL,
  status ENUM('success','failed') NOT NULL,
  customers_created INT NOT NULL DEFAULT 0,
  customers_updated INT NOT NULL DEFAULT 0,
  orders_created INT NOT NULL DEFAULT 0,
  orders_updated INT NOT NULL DEFAULT 0,
  orders_skipped INT NOT NULL DEFAULT 0,
  message VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
