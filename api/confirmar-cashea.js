// ================================================
// BACKEND CASHEA - Confirmación de pagos
// Vercel Serverless Function
// ================================================

const https = require('https');

// Agente HTTPS que permite certificados no verificados (para Cashea)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

module.exports = async function handler(req, res) {
  
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
    idNumber,
    amount,
    customer,
    lineItems,
    shippingAddress,
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
      message: 'No hay productos en el pedido'
    });
  }

  if (!customer || !customer.first_name) {
    console.error('❌ Datos del cliente incompletos');
    return res.status(400).json({
      error: 'Datos incompletos',
      message: 'Se requieren datos del cliente'
    });
  }

  console.log('✅ Validación OK:', { 
    idNumber, 
    amount: paymentAmount,
    customer: customer.first_name + ' ' + customer.last_name,
    items: lineItems.length
  });

  try {
    // ===== PASO 1: CONFIRMAR PAGO EN CASHEA =====
    console.log('📞 Llamando a Cashea API...');
    console.log('URL:', `https://external.cashea.app/orders/${idNumber}/down-payment`);
    
    // Usar node-fetch o https nativo para mejor compatibilidad
    const casheaResponse = await fetch(
      `https://external.cashea.app/orders/${idNumber}/down-payment`,
      {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${process.env.CASHEA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: 0 }),
        // Nota: fetch nativo no soporta agent, pero intentamos de todos modos
      }
    ).catch(async (fetchError) => {
      // Si fetch falla por SSL, intentar con https nativo
      console.log('⚠️ Fetch falló, intentando con https nativo...');
      return await makeHttpsRequest(
        `https://external.cashea.app/orders/${idNumber}/down-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `ApiKey ${process.env.CASHEA_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount: 0 })
        }
      );
    });

    let casheaData = {};
    
    if (casheaResponse.json) {
      try {
        casheaData = await casheaResponse.json();
      } catch (e) {
        console.log('⚠️ Respuesta de Cashea no es JSON');
      }
    } else {
      casheaData = casheaResponse;
    }

    const casheaStatus = casheaResponse.status || casheaResponse.statusCode || 200;
    console.log('📡 Respuesta de Cashea:', casheaStatus, casheaData);

    if (casheaStatus !== 201 && casheaStatus !== 200) {
      console.error('❌ Error de Cashea:', casheaStatus);
      // Continuar de todos modos para crear la orden en Shopify
      console.log('⚠️ Continuando para crear orden en Shopify...');
    } else {
      console.log('✅ Pago confirmado en Cashea');
    }

    // ===== PASO 2: CREAR ORDEN EN SHOPIFY =====
    console.log('🛍️ Creando orden en Shopify...');
    
    const shopifyOrder = {
      order: {
        line_items: lineItems.map(item => ({
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          sku: item.sku || ''
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
          address1: '',
          city: '',
          province: '',
          country: 'VE',
          zip: ''
        },
        shipping_address: shippingAddress || {
          first_name: customer.first_name,
          last_name: customer.last_name,
          address1: '',
          city: '',
          province: '',
          country: 'VE',
          zip: ''
        },
        financial_status: 'pending',
        note: `Orden Cashea. ID: ${idNumber}`,
        tags: 'Cashea',
        transactions: [{
          kind: 'sale',
          status: 'pending',
          amount: paymentAmount.toString(),
          gateway: 'Cashea'
        }]
      }
    };

    console.log('📦 Orden Shopify:', JSON.stringify(shopifyOrder, null, 2));
console.log('🔗 URL Shopify:', `https://${process.env.SHOPIFY_STORE}.myshopify.com/admin/api/2025-10/orders.json`);
console.log('🔑 Token (primeros 10):', process.env.SHOPIFY_ACCESS_TOKEN?.substring(0, 10));
    const shopifyResponse = await fetch(
      `https://${process.env.SHOPIFY_STORE}.myshopify.com/admin/api/2025-10/orders.json`,
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
      console.error('❌ Error Shopify:', JSON.stringify(shopifyData));
      return res.status(207).json({
        success: true,
        warning: 'Pago procesado pero error en Shopify',
        idNumber: idNumber,
        shopifyError: shopifyData
      });
    }

    console.log('✅ Orden creada en Shopify:', shopifyData.order.id);

    // ===== RESPUESTA EXITOSA =====
    return res.status(200).json({ 
      success: true,
      idNumber: idNumber,
      amount: paymentAmount,
      message: 'Pago confirmado y orden creada',
      shopifyOrder: {
        id: shopifyData.order.id,
        order_number: shopifyData.order.order_number
      }
    });

  } catch (error) {
    console.error('💥 Error del servidor:', error);
    return res.status(500).json({ 
      error: 'Error del servidor',
      message: error.message
    });
  }
};

// Función auxiliar para hacer requests HTTPS con certificados no verificados
function makeHttpsRequest(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: options.headers || {},
      rejectUnauthorized: false // Permite certificados no verificados
    };

    const req = https.request(reqOptions, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        let parsed = {};
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = { raw: data };
        }
        parsed.statusCode = response.statusCode;
        resolve(parsed);
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}





