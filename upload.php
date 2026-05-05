<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Content-Type: application/json');

// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    $file = $_FILES['file'];
    
    // Sanitize module name and filename
    $module = isset($_POST['module']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['module']) : 'general';
    $fileName = isset($_POST['filename']) ? basename($_POST['filename']) : basename($file['name']);
    
    // Define the base upload directory relative to this script
    $uploadDir = __DIR__ . '/_document_system/' . $module . '/';
    
    // Create the directory if it doesn't exist
    if (!file_exists($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to create directory']);
            exit;
        }
    }
    
    $destination = $uploadDir . $fileName;
    
    if (move_uploaded_file($file['tmp_name'], $destination)) {
        // Return the relative URL path so the frontend can link to it
        $fileUrl = '_document_system/' . $module . '/' . $fileName;
        echo json_encode(['success' => true, 'url' => $fileUrl]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to move uploaded file']);
    }
} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No file uploaded or invalid request']);
}
?>
