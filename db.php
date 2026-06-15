<?php
// config/db.php

$host = 'localhost'; 
$db   = 'nume_baza_de_date_cpanel'; // Înlocuiește cu numele real din cPanel
$user = 'user_baza_de_date';        // Înlocuiește cu userul real
$pass = 'parola_sigura';            // Înlocuiește cu parola

$charset = 'utf8mb4';
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // Aruncă erori fatale la probleme SQL
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,       // Returnează rezultatele sub formă de array asociativ
    PDO::ATTR_EMULATE_PREPARES   => false,                  // Securitate maximă, lasă MySQL să pregătească statement-urile
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    // În producție, scriem eroarea într-un log, nu o afișăm pe ecran
    error_log($e->getMessage());
    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode(['error' => 'Database connection failed.']);
    exit;
}
