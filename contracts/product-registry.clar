;; ProductRegistry Smart Contract
;; This contract manages the registration and tracking of products in a decentralized supply chain.
;; It ensures immutable records of product origins, metadata, and status updates.
;; Only authorized stakeholders can register or update products.

;; Constants
(define-constant ERR-UNAUTHORIZED u100)
(define-constant ERR-ALREADY-REGISTERED u101)
(define-constant ERR-INVALID-ID u102)
(define-constant ERR-INVALID-ORIGIN u103)
(define-constant ERR-INVALID-METADATA u104)
(define-constant ERR-NOT-OWNER u105)
(define-constant ERR-INVALID-STATUS u106)
(define-constant ERR-INVALID-CATEGORY u107)
(define-constant ERR-INVALID-TAGS u108)
(define-constant ERR-INVALID-COLLABORATOR u109)
(define-constant ERR-INVALID-PERMISSIONS u110)
(define-constant ERR-INVALID-VISIBILITY u111)
(define-constant ERR-INVALID-VERSION u112)
(define-constant ERR-INVALID-NOTES u113)
(define-constant ERR-INVALID-BATCH-SIZE u114)
(define-constant ERR-INVALID-SERIAL u115)
(define-constant ERR-PAUSED u116)
(define-constant ERR-INVALID-MANUFACTURER u117)
(define-constant ERR-INVALID-MATERIALS u118)
(define-constant MAX-METADATA-LEN u500)
(define-constant MAX-TAGS u10)
(define-constant MAX-PERMISSIONS u5)
(define-constant MAX-NOTES-LEN u200)
(define-constant MAX-BATCH-SIZE u100)

;; Data Variables
(define-data-var contract-owner principal tx-sender)
(define-data-var paused bool false)

;; Data Maps
(define-map product-registry
  { product-id: (string-ascii 64) }  ;; Unique product ID (e.g., UUID or hash)
  {
    owner: principal,                ;; Initial registrant (producer)
    origin: (string-utf8 100),       ;; Origin location/country
    manufacturer: (string-utf8 100), ;; Manufacturer details
    materials: (list 20 (string-utf8 50)), ;; List of materials used
    production-date: uint,           ;; Block height or timestamp
    metadata: (string-utf8 500),     ;; Additional description/metadata
    status: (string-utf8 20),        ;; e.g., "produced", "shipped", "delivered"
    visibility: bool,                ;; Public or private visibility
    last-updated: uint               ;; Last update timestamp
  }
)

(define-map product-versions
  { product-id: (string-ascii 64), version: uint }
  {
    updated-metadata: (string-utf8 500),
    update-notes: (string-utf8 200),
    timestamp: uint
  }
)

(define-map product-categories
  { product-id: (string-ascii 64) }
  {
    category: (string-utf8 50),
    tags: (list 10 (string-utf8 20))
  }
)

(define-map product-collaborators
  { product-id: (string-ascii 64), collaborator: principal }
  {
    role: (string-utf8 50),
    permissions: (list 5 (string-utf8 20)),
    added-at: uint
  }
)

(define-map product-batch
  { batch-id: (string-ascii 64) }
  {
    products: (list 100 (string-ascii 64)),
    batch-size: uint,
    created-at: uint
  }
)

(define-map product-serials
  { product-id: (string-ascii 64) }
  {
    serial-number: (string-ascii 32),
    qr-code-hash: (optional (buff 32))
  }
)

;; Public Functions

(define-public (register-product 
  (product-id (string-ascii 64)) 
  (origin (string-utf8 100)) 
  (manufacturer (string-utf8 100))
  (materials (list 20 (string-utf8 50)))
  (metadata (string-utf8 500)))
  (let ((existing (map-get? product-registry {product-id: product-id})))
    (if (var-get paused)
      (err ERR-PAUSED)
      (if (is-some existing)
        (err ERR-ALREADY-REGISTERED)
        (if (or 
             (is-eq (len product-id) u0)
             (is-eq (len origin) u0)
             (is-eq (len manufacturer) u0)
             (> (len metadata) MAX-METADATA-LEN))
          (err ERR-INVALID-ID)  ;; Using ERR-INVALID-ID as a catch-all for invalid inputs
          (begin
            (map-set product-registry
              {product-id: product-id}
              {
                owner: tx-sender,
                origin: origin,
                manufacturer: manufacturer,
                materials: materials,
                production-date: block-height,
                metadata: metadata,
                status: u"registered",
                visibility: true,
                last-updated: block-height
              })
            (ok true)))))))

(define-public (update-product-status 
  (product-id (string-ascii 64)) 
  (new-status (string-utf8 20)))
  (let ((product (map-get? product-registry {product-id: product-id})))
    (if (var-get paused)
      (err ERR-PAUSED)
      (match product
        some-product
        (if (is-eq (get owner some-product) tx-sender)
          (if (or (is-eq (len new-status) u0) (> (len new-status) u20))
            (err ERR-INVALID-STATUS)
            (begin
              (map-set product-registry
                {product-id: product-id}
                (merge some-product 
                  {status: new-status, last-updated: block-height}))
              (ok true)))
          (err ERR-NOT-OWNER))
        (err ERR-INVALID-ID)))))

(define-public (add-product-version 
  (product-id (string-ascii 64)) 
  (version uint)
  (updated-metadata (string-utf8 500))
  (notes (string-utf8 200)))
  (let ((product (map-get? product-registry {product-id: product-id})))
    (if (var-get paused)
      (err ERR-PAUSED)
      (match product
        some-product
        (if (is-eq (get owner some-product) tx-sender)
          (if (or (> (len updated-metadata) MAX-METADATA-LEN) (> (len notes) MAX-NOTES-LEN) (is-eq version u0))
            (err ERR-INVALID-VERSION)
            (begin
              (map-set product-versions
                {product-id: product-id, version: version}
                {
                  updated-metadata: updated-metadata,
                  update-notes: notes,
                  timestamp: block-height
                })
              (ok true)))
          (err ERR-NOT-OWNER))
        (err ERR-INVALID-ID)))))

(define-public (add-product-category
  (product-id (string-ascii 64))
  (category (string-utf8 50))
  (tags (list 10 (string-utf8 20))))
  (let ((product (map-get? product-registry {product-id: product-id})))
    (if (var-get paused)
      (err ERR-PAUSED)
      (match product
        some-product
        (if (is-eq (get owner some-product) tx-sender)
          (if (or (is-eq (len category) u0) (> (len tags) MAX-TAGS))
            (err ERR-INVALID-CATEGORY)
            (begin
              (map-set product-categories
                {product-id: product-id}
                {category: category, tags: tags})
              (ok true)))
          (err ERR-NOT-OWNER))
        (err ERR-INVALID-ID)))))

(define-public (add-collaborator
  (product-id (string-ascii 64))
  (collaborator principal)
  (role (string-utf8 50))
  (permissions (list 5 (string-utf8 20))))
  (let ((product (map-get? product-registry {product-id: product-id})))
    (if (var-get paused)
      (err ERR-PAUSED)
      (match product
        some-product
        (if (is-eq (get owner some-product) tx-sender)
          (if (or (is-eq (len role) u0) (> (len permissions) MAX-PERMISSIONS))
            (err ERR-INVALID-COLLABORATOR)
            (begin
              (map-set product-collaborators
                {product-id: product-id, collaborator: collaborator}
                {
                  role: role,
                  permissions: permissions,
                  added-at: block-height
                })
              (ok true)))
          (err ERR-NOT-OWNER))
        (err ERR-INVALID-ID)))))

(define-public (register-batch
  (batch-id (string-ascii 64))
  (products (list 100 (string-ascii 64))))
  (if (var-get paused)
    (err ERR-PAUSED)
    (if (or (is-eq (len batch-id) u0) (is-eq (len products) u0) (> (len products) MAX-BATCH-SIZE))
      (err ERR-INVALID-BATCH-SIZE)
      (begin
        (map-set product-batch
          {batch-id: batch-id}
          {
            products: products,
            batch-size: (len products),
            created-at: block-height
          })
        (ok true)))))

(define-public (set-serial-number
  (product-id (string-ascii 64))
  (serial (string-ascii 32))
  (qr-hash (optional (buff 32))))
  (let ((product (map-get? product-registry {product-id: product-id})))
    (if (var-get paused)
      (err ERR-PAUSED)
      (match product
        some-product
        (if (is-eq (get owner some-product) tx-sender)
          (if (is-eq (len serial) u0)
            (err ERR-INVALID-SERIAL)
            (begin
              (map-set product-serials
                {product-id: product-id}
                {serial-number: serial, qr-code-hash: qr-hash})
              (ok true)))
          (err ERR-NOT-OWNER))
        (err ERR-INVALID-ID)))))

(define-public (transfer-ownership 
  (product-id (string-ascii 64)) 
  (new-owner principal))
  (let ((product (map-get? product-registry {product-id: product-id})))
    (if (var-get paused)
      (err ERR-PAUSED)
      (match product
        some-product
        (if (is-eq (get owner some-product) tx-sender)
          (begin
            (map-set product-registry
              {product-id: product-id}
              (merge some-product {owner: new-owner}))
            (ok true))
          (err ERR-NOT-OWNER))
        (err ERR-INVALID-ID)))))

(define-public (toggle-pause)
  (if (is-eq tx-sender (var-get contract-owner))
    (begin
      (var-set paused (not (var-get paused)))
      (ok (var-get paused)))
    (err ERR-UNAUTHORIZED)))

;; Read-Only Functions

(define-read-only (get-product-details (product-id (string-ascii 64)))
  (map-get? product-registry {product-id: product-id}))

(define-read-only (get-product-version (product-id (string-ascii 64)) (version uint))
  (map-get? product-versions {product-id: product-id, version: version}))

(define-read-only (get-product-category (product-id (string-ascii 64)))
  (map-get? product-categories {product-id: product-id}))

(define-read-only (get-collaborator (product-id (string-ascii 64)) (collaborator principal))
  (map-get? product-collaborators {product-id: product-id, collaborator: collaborator}))

(define-read-only (get-batch-details (batch-id (string-ascii 64)))
  (map-get? product-batch {batch-id: batch-id}))

(define-read-only (get-serial-number (product-id (string-ascii 64)))
  (map-get? product-serials {product-id: product-id}))

(define-read-only (is-paused)
  (var-get paused))

(define-read-only (get-owner (product-id (string-ascii 64)))
  (match (map-get? product-registry {product-id: product-id})
    some-product (ok (get owner some-product))
    (err ERR-INVALID-ID)))

(define-read-only (verify-ownership (product-id (string-ascii 64)) (claimed-owner principal))
  (match (map-get? product-registry {product-id: product-id})
    some-product (ok (is-eq (get owner some-product) claimed-owner))
    (err ERR-INVALID-ID)))