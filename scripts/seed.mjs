import pg from 'pg';
import bcrypt from 'bcryptjs';
// Same embedding code the app uses (real all-MiniLM-L6-v2 via transformers.js)
import {
  generateLocalEmbedding,
  buildPropertySearchText,
  toVectorLiteral,
  LOCAL_MODEL_NAME,
} from '../lib/embeddings.ts';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function seed() {
  console.log('--- Starting PropFind Database Seeding ---');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Clear existing data
    console.log('Clearing old sample records...');
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM booking_audit');
    await client.query('DELETE FROM reviews');
    await client.query('DELETE FROM bookings');
    await client.query('DELETE FROM property_embeddings');
    await client.query('DELETE FROM properties');
    await client.query('DELETE FROM users');

    // 2. Insert Users (Owners and Tenants)
    console.log('Inserting Owners and Tenants...');
    const demoPassword = process.env.SEED_PASSWORD || 'password123';
    const passwordHash = await bcrypt.hash(demoPassword, 10);
    const demoUsers = [
      ['Priya Sharma', 'priya.sharma@example.com', 'OWNER', '+91 98765 43210'],
      ['Rahul Verma', 'rahul.verma@example.com', 'OWNER', '+91 98111 22334'],
      ['Ananya Roy', 'ananya.roy@example.com', 'OWNER', '+91 99000 88776'],
      ['Rohan Nair', 'rohan.nair@example.com', 'TENANT', '+91 97400 11223'],
      ['Sneha Patel', 'sneha.patel@example.com', 'TENANT', '+91 96200 44556'],
      ['Admin User', 'admin@example.com', 'ADMIN', '+91 90000 00000'],
    ];
    const ownerRes = { rows: [] };
    for (const [name, email, role, phone] of demoUsers) {
      const r = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role, phone)
         VALUES ($1, $2, $3, $4::user_role, $5)
         RETURNING id, full_name, role`,
        [name, email, passwordHash, role, phone]
      );
      ownerRes.rows.push(r.rows[0]);
    }

    const priyaId = ownerRes.rows.find((u) => u.full_name === 'Priya Sharma').id;
    const rahulId = ownerRes.rows.find((u) => u.full_name === 'Rahul Verma').id;
    const ananyaId = ownerRes.rows.find((u) => u.full_name === 'Ananya Roy').id;
    const rohanId = ownerRes.rows.find((u) => u.full_name === 'Rohan Nair').id;
    const snehaId = ownerRes.rows.find((u) => u.full_name === 'Sneha Patel').id;

    // 3. Insert Properties
    console.log('Inserting Properties catalog...');
    const propertiesData = [
      {
        owner_id: priyaId,
        title: 'Serene 2BHK near Manyata Tech Park with Balcony',
        description: 'Quiet and peaceful 2BHK apartment situated inside a green gated society just 5 minutes away from Manyata Tech Park. Features a large sunlit balcony, pet friendly society guidelines, power backup, and dedicated covered car parking.',
        property_type: 'Apartment',
        price_per_month: 23000.00,
        security_deposit: 50000.00,
        bedrooms: 2,
        bathrooms: 2,
        area_sqft: 1150,
        address: 'Tower B, Green Meadows, Nagawara Main Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560045',
        status: 'AVAILABLE',
        amenities: ['Pet Friendly', 'Balcony', 'Covered Parking', 'Power Backup', 'Security 24x7'],
        image_url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      },
      {
        owner_id: priyaId,
        title: 'Ultra Luxury 3BHK Penthouse with Private Terrace & Pool Access',
        description: 'Exclusive luxury high-rise penthouse overlooking Hiranandani Powai lake. Ultra modern Italian marble flooring, imported modular kitchen, private rooftop terrace, olympic size swimming pool, high-end fitness gym, and clubhouse.',
        property_type: 'Penthouse',
        price_per_month: 85000.00,
        security_deposit: 200000.00,
        bedrooms: 3,
        bathrooms: 3,
        area_sqft: 2200,
        address: 'Sky Heights, Central Avenue, Powai',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400076',
        status: 'AVAILABLE',
        amenities: ['Swimming Pool', 'Luxury Gym', 'Rooftop Terrace', 'Lake View', 'Clubhouse', 'Concierge'],
        image_url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      },
      {
        owner_id: rahulId,
        title: 'Budget 1BHK Student Apartment Near Indiranagar Metro',
        description: 'Affordable compact 1BHK flat ideal for college students or working professionals. Located within 200 meters walking distance from Indiranagar Metro Station. Low security deposit, high speed wifi ready, semi-furnished with wardrobe and geyser.',
        property_type: 'Apartment',
        price_per_month: 14500.00,
        security_deposit: 30000.00,
        bedrooms: 1,
        bathrooms: 1,
        area_sqft: 550,
        address: '12th Main Road, HAL 2nd Stage, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        status: 'AVAILABLE',
        amenities: ['Near Metro Station', 'High Speed Wifi', 'Semi-Furnished', 'Low Deposit'],
        image_url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
      },
      {
        owner_id: rahulId,
        title: 'Spacious 3BHK Independent Villa with Private Garden',
        description: 'Tranquil 3BHK duplex villa in a quiet gated community near Hinjewadi Phase 1 IT hub. Beautiful lawn garden for pets and children, serene environment away from city noise, jogging track, and 24-hour solar water heating.',
        property_type: 'Villa',
        price_per_month: 38000.00,
        security_deposit: 80000.00,
        bedrooms: 3,
        bathrooms: 3,
        area_sqft: 1850,
        address: 'Villa 14, Palm Grove Enclave, Hinjewadi',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411057',
        status: 'AVAILABLE',
        amenities: ['Private Garden', 'Pet Friendly', 'Gated Community', 'Quiet Environment', 'Jogging Track'],
        image_url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
      },
      {
        owner_id: ananyaId,
        title: 'Modern Fully-Furnished Studio Apartment in Hitec City',
        description: 'Chic urban studio apartment tailored for tech professionals. Fully furnished with smart TV, work desk, high-speed fiber internet, modular kitchenette, and attached balcony. Walking distance to DLF Cybercity.',
        property_type: 'Studio',
        price_per_month: 21000.00,
        security_deposit: 45000.00,
        bedrooms: 1,
        bathrooms: 1,
        area_sqft: 480,
        address: 'Cyber Nest, Gachibowli - Hitec City Main Road',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        status: 'AVAILABLE',
        amenities: ['Fully Furnished', 'Work Desk', 'Near IT Corridor', 'AC', 'Power Backup'],
        image_url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
      },
      {
        owner_id: ananyaId,
        title: 'Cozy 2BHK Family Home with Modular Kitchen in Whitefield',
        description: 'Sunlit and airy 2BHK flat close to ITPL tech park, Whitefield. Features piped gas line, wooden flooring in master bedroom, kids play area, 24x7 security, and close proximity to international schools and shopping malls.',
        property_type: 'Apartment',
        price_per_month: 27500.00,
        security_deposit: 60000.00,
        bedrooms: 2,
        bathrooms: 2,
        area_sqft: 1200,
        address: 'Block C, Orchid Woods, Hope Farm Junction',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560066',
        status: 'AVAILABLE',
        amenities: ['Modular Kitchen', 'Kids Play Area', '24x7 Security', 'Piped Gas', 'Balcony'],
        image_url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
      }
    ];

    const insertedProperties = [];
    for (const p of propertiesData) {
      const pRes = await client.query(
        `INSERT INTO properties (
          owner_id, title, description, property_type, price_per_month,
          security_deposit, bedrooms, bathrooms, area_sqft, address,
          city, state, pincode, status, amenities, image_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          p.owner_id, p.title, p.description, p.property_type, p.price_per_month,
          p.security_deposit, p.bedrooms, p.bathrooms, p.area_sqft, p.address,
          p.city, p.state, p.pincode, p.status, p.amenities, p.image_url
        ]
      );
      insertedProperties.push(pRes.rows[0]);
    }

    // 4. Generate and Insert Vector Embeddings into property_embeddings
    console.log('Generating 384-dimensional all-MiniLM-L6-v2 embeddings (first run downloads the model)...');
    for (const prop of insertedProperties) {
      const searchContent = buildPropertySearchText(prop);
      const embedding = await generateLocalEmbedding(searchContent);

      await client.query(
        `INSERT INTO property_embeddings (property_id, embedding, model_name, indexed_content)
         VALUES ($1, $2::vector, $3, $4)`,
        [prop.id, toVectorLiteral(embedding), LOCAL_MODEL_NAME, searchContent]
      );
    }

    // 5. Insert Sample Reviews
    console.log('Inserting sample tenant reviews...');
    await client.query(`
      INSERT INTO reviews (property_id, tenant_id, rating, comment)
      VALUES 
        ($1, $2, 5, 'Lived here for 6 months. Very quiet and pet-friendly environment. Commute to Manyata Tech Park takes less than 10 mins!'),
        ($3, $4, 4, 'Great location right next to the metro station! Highly recommend for students or singles.'),
        ($5, $2, 5, 'The private lawn is wonderful. Society security is very responsive.')
    `, [
      insertedProperties[0].id, rohanId,
      insertedProperties[2].id, snehaId,
      insertedProperties[3].id
    ]);

    // 6. Insert Sample Booking
    console.log('Inserting sample booking records...');
    await client.query(`
      INSERT INTO bookings (property_id, tenant_id, start_date, end_date, total_amount, status, special_requests)
      VALUES 
        ($1, $2, '2026-11-15', '2026-12-15', 23000.00, 'APPROVED', 'Move-in after 11am on weekend'),
        ($3, $4, '2026-12-01', '2027-01-01', 14500.00, 'PENDING', 'Need parking space confirmation')
    `, [
      insertedProperties[0].id, rohanId,
      insertedProperties[2].id, snehaId
    ]);

    await client.query('COMMIT');
    console.log('✅ PropFind Database Seeded Successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
