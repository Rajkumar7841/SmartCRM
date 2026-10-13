USE smartcrm;

INSERT INTO customers (id, name, email, phone, address, source, created_at) VALUES
(1, 'Aarav Sharma',   'aarav.sharma@example.com',   '+91 98220 11001', '12 MG Road, Pune, Maharashtra',        'demo', DATE_SUB(NOW(), INTERVAL 30 DAY)),
(2, 'Priya Nair',     'priya.nair@example.com',     '+91 98220 11002', '45 Marine Drive, Kochi, Kerala',       'demo', DATE_SUB(NOW(), INTERVAL 25 DAY)),
(3, 'Rohan Mehta',    'rohan.mehta@example.com',    '+91 98220 11003', '8 Park Street, Kolkata, West Bengal',  'demo', DATE_SUB(NOW(), INTERVAL 18 DAY)),
(4, 'Sneha Kulkarni', 'sneha.kulkarni@example.com', '+91 98220 11004', '22 College Road, Nashik, Maharashtra',  'demo', DATE_SUB(NOW(), INTERVAL 10 DAY)),
(5, 'Vikram Singh',   'vikram.singh@example.com',   '+91 98220 11005', '5 Connaught Place, New Delhi',         'demo', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(6, 'Ananya Iyer',    'ananya.iyer@example.com',    '+91 98220 11006', '31 Anna Salai, Chennai, Tamil Nadu',   'demo', DATE_SUB(NOW(), INTERVAL 1 DAY));

INSERT INTO orders (id, customer_id, order_number, total, status, item_summary, order_date, source) VALUES
(1,  1, '#1001', 2499.00, 'completed',  '1x Wireless Earbuds',          DATE_SUB(NOW(), INTERVAL 20 DAY), 'demo'),
(2,  1, '#1002',  799.00, 'completed',  '2x Phone Case',                DATE_SUB(NOW(), INTERVAL 12 DAY), 'demo'),
(3,  2, '#1003', 5999.00, 'completed',  '1x Smart Watch',               DATE_SUB(NOW(), INTERVAL 15 DAY), 'demo'),
(4,  2, '#1004', 1299.00, 'pending',    '1x Backpack',                  DATE_SUB(NOW(), INTERVAL 2 DAY),  'demo'),
(5,  3, '#1005', 3499.00, 'processing', '1x Bluetooth Speaker',         DATE_SUB(NOW(), INTERVAL 3 DAY),  'demo'),
(6,  3, '#1006',  499.00, 'cancelled',  '1x USB Cable (pack of 3)',     DATE_SUB(NOW(), INTERVAL 9 DAY),  'demo'),
(7,  4, '#1007', 8999.00, 'completed',  '1x Tablet Stand, 1x Keyboard', DATE_SUB(NOW(), INTERVAL 7 DAY),  'demo'),
(8,  5, '#1008', 1599.00, 'pending',    '1x Desk Lamp',                 DATE_SUB(NOW(), INTERVAL 1 DAY),  'demo'),
(9,  6, '#1009', 2199.00, 'on-hold',    '2x Yoga Mat',                  DATE_SUB(NOW(), INTERVAL 4 DAY),  'demo'),
(10, 6, '#1010', 3299.00, 'completed',  '1x Running Shoes',             DATE_SUB(NOW(), INTERVAL 5 DAY),  'demo');

INSERT INTO messages (id, customer_id, order_id, subject, body, status, delivery, error_message, created_at, sent_at) VALUES
(1, 2, 4, 'Your order #1004 is being prepared',
 'Hi Priya Nair,\n\nThanks for ordering! Your order #1004 is being prepared and will ship soon.\n\nTeam SmartCRM',
 'Pending', 'saved', NULL, DATE_SUB(NOW(), INTERVAL 1 DAY), NULL),
(2, 1, 2, 'Thanks for your purchase',
 'Hi Aarav Sharma,\n\nThank you for order #1002. We hope you love it!\n\nTeam SmartCRM',
 'Completed', 'simulated', NULL, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 10 DAY)),
(3, 3, 6, 'About your cancelled order',
 'Hi Rohan Mehta,\n\nWe noticed order #1006 was cancelled. Can we help with anything?\n\nTeam SmartCRM',
 'Failed', 'saved', 'Demo seed: mailbox unreachable', DATE_SUB(NOW(), INTERVAL 8 DAY), NULL);
