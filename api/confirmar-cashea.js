// ================================================
// BACKEND CASHEA - Confirmación de pagos
// Relojteca - Vercel Function
// ================================================

export default async function handler(req, res) {
  
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Manejar preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Método no permitido',
      message: 'Solo se acepta POST' 
    });
  }

  console.log('📥 Solicitud recibida:', JSON.stringify(req.body, null, 2));
  
  // Extraer datos del body
  const { 
    idNumber,      // ID de la orden en Cashea
    amount,        // Monto del pago
    customer,      // Datos del cliente
    lineItems,     // Items del carrito
    shippingAddress, // Dirección de envío
    email,
    phone
  } = req.body;

  // ===== VALIDACIONES =====
  if (!idNumber) {
    console.error('❌ idNumber faltante');
    return res.status(400).json({ 
      error: 'Datos incompletos',
      message: 'Se requiere idNumber' 
    });
  }

  const paymentAmount = parseFloat(amount) || 0;
  
  if (paymentAmount <= 0) {
    console.error('❌ Monto inválido:', paymentAmount);
    return res.status(400).json({
      error: 'Monto inválido',
      message: 'El monto debe ser mayor a 0'
    });
  }

  if (!lineItems || lineItems.length === 0) {
    console.error('❌ No hay productos en el pedido');
    return res.status(400).json({
      error: 'Datos incompletos',
      message: 'Se requiere al menos un producto'
    });
  }

  if (!customer || !customer.first_name || !customer.last_name) {
    console.error('❌ Datos del cliente incompletos');
    return res.status(400).json({
      error: 'Datos incompletos',
      message: 'Se requieren datos completos del cliente'
    });
  }

  console.log('✅ Validación OK:', { 
    idNumber, 
    amount: paymentAmount,
    customer: `${customer.first_name} ${customer.last_name}`,
    items: lineItems.length
  });

  try {
    // ===== PASO 1: CONFIRMAR PAGO EN CASHEA =====
    console.log('📞 Llamando a Cashea API...');
    
    const casheaResponse = await fetch(
      `https://external.cashea.app/orders/${idNumber}/down-payment`,
      {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${process.env.CASHEA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          amount: paymentAmount 
        }),
      }
    );

    let casheaData = {};
    try {
      casheaData = await casheaResponse.json();
    } catch (e) {
      console.log('⚠️ Respuesta de Cashea no es JSON');
    }

    console.log('📡 Respuesta de Cashea:', casheaResponse.status, casheaData);

    if (casheaResponse.status !== 201 && casheaResponse.status !== 200) {
      console.error('❌ Error de Cashea:', casheaResponse.status);
      return res.status(casheaResponse.status).json({ 
        error: 'Error al confirmar con Cashea',
        status: casheaResponse.status,
        details: casheaData,
        idNumber: idNumber
      });
    }

    console.log('✅ Pago confirmado en Cashea');

    // ===== PASO 2: CREAR ORDEN EN SHOPIFY =====
    console.log('🛍️ Creando orden en Shopify...');
    
    const shopifyOrder = {
      order: {
        line_items: lineItems.map(item => ({
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          sku: item.sku || '',
          variant_id: item.variant_id || null
        })),
        customer: {
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: email || customer.email,
          phone: phone || customer.phone
        },
        billing_address: shippingAddress || {
          first_name: customer.first_name,
          last_name: customer.last_name,
          address1: customer.address1 || '',
          city: customer.city || '',
          province: customer.province || '',
          country: customer.country || 'VE',
          zip: customer.zip || ''
        },
        shipping_address: shippingAddress || {
          first_name: customer.first_name,
          last_name: customer.last_name,
          address1: customer.address1 || '',
          city: customer.city || '',
          province: customer.province || '',
          country: customer.country || 'VE',
          zip: customer.zip || ''
        },
        financial_status: 'pending',
        fulfillment_status: null,
        note: `Orden creada desde Cashea. ID: ${idNumber}`,
        tags: 'Cashea',
        transactions: [
          {
            kind: 'sale',
            status: 'pending',
            amount: paymentAmount.toString(),
            gateway: 'Cashea'
          }
        ]
      }
    };

    const shopifyResponse = await fetch(
      `https://${process.env.SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/orders.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shopifyOrder)
      }
    );

    const shopifyData = await shopifyResponse.json();
    
    if (!shopifyResponse.ok) {
      console.error('❌ Error al crear orden en Shopify:', shopifyData);
      
      return res.status(207).json({
        success: true,
        warning: 'Pago confirmado en Cashea pero error al crear orden en Shopify',
        idNumber: idNumber,
        amount: paymentAmount,
        casheaResponse: casheaData,
        shopifyError: shopifyData
      });
    }

    console.log('✅ Orden creada en Shopify:', shopifyData.order.id);

    // ===== RESPUESTA EXITOSA =====
    return res.status(200).json({ 
      success: true,
      idNumber: idNumber,
      amount: paymentAmount,
      message: 'Pago confirmado en Cashea y orden creada en Shopify',
      casheaResponse: casheaData,
      shopifyOrder: {
        id: shopifyData.order.id,
        order_number: shopifyData.order.order_number,
        total_price: shopifyData.order.total_price,
        admin_url: shopifyData.order.admin_graphql_api_id
      }
    });

  } catch (error) {
    console.error('💥 Error del servidor:', error);
    
    return res.status(500).json({ 
      error: 'Error del servidor',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      idNumber: idNumber
    });
  }
}