-- Creare Tabel Categorii
CREATE TABLE categories (
    slug VARCHAR(50) PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    tagline VARCHAR(255),
    description TEXT,
    image_url VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Creare Tabel Segmente Clienți (Hotel, Restaurant, etc.)
CREATE TABLE client_types (
    slug VARCHAR(50) PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    icon_svg TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Creare Tabel Produse
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cod VARCHAR(50) NOT NULL,
    nume VARCHAR(255) NOT NULL,
    cat_slug VARCHAR(50) NOT NULL,
    bax VARCHAR(50),
    decongelare VARCHAR(50),
    temp VARCHAR(50),
    coacere VARCHAR(50),
    descriere TEXT,
    image_main VARCHAR(255),
    status ENUM('DRAFT_SCRAPER', 'PUBLISHED', 'HIDDEN') DEFAULT 'DRAFT_SCRAPER',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cat_slug) REFERENCES categories(slug) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Creare Tabel de Legătură: Produse <-> Segmente Clienți
CREATE TABLE product_clients (
    product_id INT NOT NULL,
    client_slug VARCHAR(50) NOT NULL,
    PRIMARY KEY (product_id, client_slug),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (client_slug) REFERENCES client_types(slug) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Creare Tabel Noutăți
CREATE TABLE news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    display_date VARCHAR(50),
    content TEXT,
    cat_tag VARCHAR(50),
    image_url VARCHAR(255),
    is_published TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Creare Tabel Administratori
CREATE TABLE admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('SUPER_ADMIN', 'EDITOR') DEFAULT 'EDITOR'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
