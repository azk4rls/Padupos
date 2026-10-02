import type { FastifyPluginAsync } from 'fastify';
import {
  createProductCategorySchema,
  createProductSchema,
  updateProductSchema,
  createRecipeSchema,
  paginationSchema,
} from '@padupos/validation';
import { domainStore } from '../domainStore.js';
import { requirePermission } from '../../plugins/rbac.js';
import { generatePrefixedId } from '@padupos/shared';
import type { Product, ProductCategory, ProductPrice, Recipe, Inventory } from '@padupos/types';

export const productsRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = [(fastify as any).authenticate, (fastify as any).resolveTenant];

  // 1. Categories
  fastify.get('/categories', { preHandler: [...auth, requirePermission('products.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const categories: ProductCategory[] = [];
    for (const cat of domainStore.categories.values()) {
      if (cat.businessId === businessId) categories.push(cat);
    }
    return { categories };
  });

  fastify.post('/categories', { preHandler: [...auth, requirePermission('products.create')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const body = createProductCategorySchema.parse(request.body);

    const categoryId = generatePrefixedId('cat');
    const category: ProductCategory = {
      id: categoryId,
      businessId,
      name: body.name,
      description: body.description,
      parentId: body.parentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    domainStore.categories.set(categoryId, category);
    return reply.status(201).send({ category });
  });

  // 2. Products List (Search & Paginated)
  fastify.get('/products', { preHandler: [...auth, requirePermission('products.view')] }, async (request) => {
    const businessId = request.businessContext!.businessId;
    const query = paginationSchema.parse(request.query);
    const search = query.search?.toLowerCase();

    const matching: Array<Product & { price?: ProductPrice }> = [];
    for (const prod of domainStore.products.values()) {
      if (prod.businessId === businessId && prod.isActive) {
        if (search) {
          const matchName = prod.name.toLowerCase().includes(search);
          const matchSku = prod.sku?.toLowerCase().includes(search);
          const matchBarcode = prod.barcode?.toLowerCase().includes(search);
          if (!matchName && !matchSku && !matchBarcode) continue;
        }

        // Attach current active price
        let price: ProductPrice | undefined;
        for (const p of domainStore.prices.values()) {
          if (p.productId === prod.id) {
            price = p;
            break;
          }
        }

        matching.push({ ...prod, price });
      }
    }

    const total = matching.length;
    const start = (query.page - 1) * query.limit;
    const paginated = matching.slice(start, start + query.limit);

    return {
      items: paginated,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  });

  // 3. Create Product
  fastify.post('/products', { preHandler: [...auth, requirePermission('products.create')] }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const body = createProductSchema.parse(request.body);

    const productId = generatePrefixedId('prod');
    const priceId = generatePrefixedId('prc');

    const product: Product = {
      id: productId,
      businessId,
      categoryId: body.categoryId,
      name: body.name,
      localizedNames: body.localizedNames,
      sku: body.sku,
      barcode: body.barcode,
      unit: body.unit,
      description: body.description,
      costMethod: body.costMethod,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const biz = domainStore.businesses.get(businessId);
    const currency = biz ? biz.baseCurrency : 'IDR';

    const price: ProductPrice = {
      id: priceId,
      productId,
      currency,
      costPrice: body.costPrice,
      sellingPrice: body.sellingPrice,
      effectiveFrom: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    domainStore.products.set(productId, product);
    domainStore.prices.set(priceId, price);

    // Initialize inventory record for every branch of this business
    for (const brn of domainStore.branches.values()) {
      if (brn.businessId === businessId) {
        const invKey = `${brn.id}:${productId}:`;
        if (!domainStore.inventories.has(invKey)) {
          const inv: Inventory = {
            id: generatePrefixedId('inv'),
            businessId,
            branchId: brn.id,
            productId,
            quantity: '0.0000',
            reservedQuantity: '0.0000',
            availableQuantity: '0.0000',
            averageCost: body.costPrice,
            minimumStock: '5.0000',
            updatedAt: new Date().toISOString(),
          };
          domainStore.inventories.set(invKey, inv);
        }
      }
    }

    return reply.status(201).send({ product, price });
  });

  // 4. Product Details
  fastify.get<{ Params: { id: string } }>('/products/:id', {
    preHandler: [...auth, requirePermission('products.view')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const prod = domainStore.products.get(request.params.id);

    if (!prod || prod.businessId !== businessId) {
      return reply.status(404).send({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found', requestId: request.id },
      });
    }

    let price: ProductPrice | undefined;
    for (const p of domainStore.prices.values()) {
      if (p.productId === prod.id) {
        price = p;
        break;
      }
    }

    let recipe: Recipe | undefined;
    for (const r of domainStore.recipes.values()) {
      if (r.productId === prod.id && r.isActive) {
        recipe = r;
        break;
      }
    }

    return { product: prod, price, recipe };
  });

  // 5. Update Product
  fastify.patch<{ Params: { id: string } }>('/products/:id', {
    preHandler: [...auth, requirePermission('products.update')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const prod = domainStore.products.get(request.params.id);

    if (!prod || prod.businessId !== businessId) {
      return reply.status(404).send({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found', requestId: request.id },
      });
    }

    const body = updateProductSchema.parse(request.body);
    const updated: Product = {
      ...prod,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    domainStore.products.set(prod.id, updated);
    return { product: updated };
  });

  // 6. Recipe Management (F&B mode)
  fastify.post<{ Params: { id: string } }>('/products/:id/recipe', {
    preHandler: [...auth, requirePermission('products.update')],
  }, async (request, reply) => {
    const businessId = request.businessContext!.businessId;
    const prod = domainStore.products.get(request.params.id);

    if (!prod || prod.businessId !== businessId) {
      return reply.status(404).send({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found', requestId: request.id },
      });
    }

    const body = createRecipeSchema.parse({ ...request.body as object, productId: prod.id });
    const recipeId = generatePrefixedId('rcp');

    const recipe: Recipe = {
      id: recipeId,
      businessId,
      productId: prod.id,
      variantId: body.variantId,
      yieldQuantity: body.yieldQuantity,
      yieldUnit: body.yieldUnit,
      isActive: true,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    domainStore.recipes.set(recipeId, recipe);
    return reply.status(201).send({ recipe, items: body.items });
  });
};
