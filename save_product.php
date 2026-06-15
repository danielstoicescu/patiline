<?php
// api/admin/save_product.php
header('Content-Type: application/json; charset=utf-8');
require_once '../../config/db.php';

// Aici s-ar verifica sesiunea de admin (ex: if(!isset($_SESSION['admin_id'])) exit;)

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Preluăm datele trimise via Fetch API din interfața de Admin
    $data = json_decode(file_get_contents('php://input'), true);

    try {
        $pdo->beginTransaction();

        // 1. Update sau Insert Produs
        $stmt = $pdo->prepare("
            UPDATE products 
            SET nume = ?, cod = ?, cat_slug = ?, bax = ?, decongelare = ?, temp = ?, coacere = ?, descriere = ?, status = 'PUBLISHED'
            WHERE id = ?
        ");
        
        $stmt->execute([
            $data['nume'], $data['cod'], $data['cat_slug'], $data['bax'], 
            $data['decongelare'], $data['temp'], $data['coacere'], $data['desc'], $data['id']
        ]);

        // 2. Ștergem vechile taguri de clienți și le inserăm pe cele noi (Hotel, Restaurant, etc.)
        $delStmt = $pdo->prepare("DELETE FROM product_clients WHERE product_id = ?");
        $delStmt->execute([$data['id']]);

        if (!empty($data['clienti']) && is_array($data['clienti'])) {
            $insertClient = $pdo->prepare("INSERT INTO product_clients (product_id, client_slug) VALUES (?, ?)");
            foreach ($data['clienti'] as $client_slug) {
                $insertClient->execute([$data['id'], $client_slug]);
            }
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Produsul a fost publicat și validat.']);

    } catch (Exception $e) {
        $pdo->rollBack();
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'A apărut o eroare la salvare.']);
    }
}
