# 🔄 Cashea ↔️ Shopify Integration Backend

Backend serverless para sincronizar pagos de Cashea con órdenes de Shopify - Relojteca.

## 📋 Características

- ✅ Confirmación automática de pagos en Cashea
- ✅ Creación de órdenes en Shopify
- ✅ Validación de datos completos (productos, cliente, dirección)
- ✅ Actualización automática de inventario
- ✅ Manejo robusto de errores
- ✅ Logs detallados para debugging

## 🏗️ Estructura del Proyecto

```
cashea-backend-relojteca/
├── api/
│   └── confirmar-cashea.js    # Función principal
├── package.json               # Dependencias
├── vercel.json               # Configuración de Vercel
├── .env.example              # Ejemplo de variables de entorno
└── README.md                 # Esta documentación
```

## 🚀 Deployment en Vercel

### Paso 1: Subir a GitHub

```bash
git add .
git commit -m "Integración completa Cashea-Shopify"
git push origin main
```

### Paso 2: Deploy en Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Click en **Add New** > **Project**
3. Importa tu repositorio: `fidelopez89/cashea-backend-relojteca`
4. En **Environment Variables**, agrega:
   ```
   CASHEA_API_KEY=5f7747b87bbf114a29343094fe49e901
   SHOPIFY_STORE=relojteca
   SHOPIFY_ACCESS_TOKEN=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
   NODE_ENV=production
   ```
5. Click en **Deploy**

### Paso 3: URL del Endpoint

Una vez desplegado, tu endpoint será:
```
https://cashea-backend-relojteca.vercel.app/api/confirmar-cashea
```

## 🧪 Testing

### Ejemplo de solicitud:

```bash
curl -X POST https://cashea-backend-relojteca.vercel.app/api/confirmar-cashea \
  -H "Content-Type: application/json" \
  -d '{
    "idNumber": "123456",
    "amount": 100.00,
    "customer": {
      "first_name": "Juan",
      "last_name": "Pérez",
      "email": "juan@example.com",
      "phone": "+58412xxxxxxx",
      "address1": "Calle Principal 123",
      "city": "Caracas",
      "province": "Miranda",
      "country": "VE",
      "zip": "1010"
    },
    "lineItems": [
      {
        "title": "Reloj Casio G-Shock",
        "price": "100.00",
        "quantity": 1,
        "sku": "CASIO-GSHOCK-001"
      }
    ],
    "shippingAddress": {
      "first_name": "Juan",
      "last_name": "Pérez",
      "address1": "Calle Principal 123",
      "city": "Caracas",
      "province": "Miranda",
      "country": "VE",
      "zip": "1010"
    }
  }'
```

### Respuesta esperada (éxito):

```json
{
  "success": true,
  "idNumber": "123456",
  "amount": 100.00,
  "message": "Pago confirmado en Cashea y orden creada en Shopify",
  "shopifyOrder": {
    "id": 5678901234,
    "order_number": 1001,
    "total_price": "100.00"
  }
}
```

## 🔧 Troubleshooting

### Error: "Error al confirmar con Cashea"
- Verifica que `CASHEA_API_KEY` esté correcta en Vercel
- Confirma que el `idNumber` sea válido

### Error: "Error al crear orden en Shopify"
- Verifica `SHOPIFY_STORE` y `SHOPIFY_ACCESS_TOKEN` en Vercel
- Confirma que la Legacy Custom App tenga los permisos necesarios

### Error: "Datos incompletos"
- Asegúrate de enviar `idNumber`, `amount`, `customer` y `lineItems`

## 📊 Logs

Para ver logs en Vercel:
1. Ve a tu proyecto en Vercel
2. Click en **Deployments**
3. Click en tu deployment más reciente
4. Ve a **Functions** > `api/confirmar-cashea`

## 🔒 Seguridad

- ✅ API keys almacenadas como variables de entorno
- ✅ CORS configurado
- ✅ Validación de datos de entrada
- ✅ Manejo seguro de errores

## 📝 Changelog

### v2.0.0 (Actual)
- ✅ Integración completa con Shopify usando Legacy Custom App
- ✅ Validación completa de datos
- ✅ Actualización automática de inventario
- ✅ Logs detallados