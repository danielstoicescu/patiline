<?php
// api/products.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // Restricționează la domeniul tău în producție

require_once '../config/db.php';

try {
    // 1. Extragem doar produsele PUBLISHED
    $stmt = $pdo->prepare("
        SELECT id, cod, nume, cat_slug as cat, bax, decongelare, temp, coacere, descriere as `desc`
        FROM products 
        WHERE status = 'PUBLISHED'
    ");
    $stmt->execute();
    $products = $stmt->fetchAll();

    // 2. Extragem asocierile cu tipurile de clienți
    $clientsStmt = $pdo->prepare("SELECT product_id, client_slug FROM product_clients");
    $clientsStmt->execute();
    $allClients = $clientsStmt->fetchAll();

    // 3. Grupăm clienții după product_id pentru eficiență
    $clientMap = [];
    foreach ($allClients as $row) {
        $clientMap[$row['product_id']][] = $row['client_slug'];
    }

    // 4. Asamblăm rezultatul final
    $finalProducts = [];
    foreach ($products as $p) {
        // Mapăm corect numele categoriei (în loc de slug, dacă e nevoie în frontend)
        // În JS-ul tău original, foloseai numele cu diacritice, ex: "Deserturi", "Amuse-Bouche"
        $p['clienti'] = isset($clientMap[$p['id']]) ? $clientMap[$p['id']] : [];
        $finalProducts[] = $p;
    }

    echo json_encode($finalProducts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    error_log($e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Eroare la extragerea datelor.']);
}
