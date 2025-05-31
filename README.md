# mercado-libre-clone
An application replicating Mercado Libre Page. But using the best practices and programming concepts

---

## Directory Backend structure

This is a high-level overview of the backend directory structure, following the principles of Clean Architecture and Domain-Driven Design (DDD). Each layer has its own responsibilities, promoting separation of concerns and maintainability. (Hexagonal Architecture)

```
packages/backend/
├── src/
│   ├── application/           # Use cases and application rules 
│   │   ├── usecases/
│   │   │   └── product/
│   │   │       ├── get-product-details.usecase.ts
│   │   │       └── list-products.usecase.ts
│   │   ├── dtos/             # Data Transfer Objects
│   │   └── ports/            # Interfaces/Contracts
│   │       ├── repositories/
│   │       └── services/
│   ├── domain/               # Entities and business rules
│   │   ├── entities/
│   │   │   ├── product.entity.ts
│   │   │   ├── seller.entity.ts
│   │   │   └── payment-method.entity.ts
│   │   ├── value-objects/
│   │   └── errors/
│   ├── infrastructure/       # Concrete implementations
│   │   ├── repositories/
│   │   │   └── json-product.repository.ts
│   │   ├── database/
│   │   │   └── products.json
│   │   └── config/
│   ├── presentation/         # Controllers and middlewares
│   │   ├── controllers/
│   │   │   └── product.controller.ts
│   │   ├── middlewares/
│   │   │   ├── error-handler.middleware.ts
│   │   │   ├── validation.middleware.ts
│   │   │   └── cors.middleware.ts
│   │   ├── routes/
│   │   │   └── product.routes.ts
│   │   └── schemas/
│   ├── shared/               # Shared utilities
│   │   ├── utils/
│   │   ├── constants/
│   │   └── types/
│   └── main.ts              # Entry point of the application
├── tests/                   # Unit and integration tests
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/                    # API documentation
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── eslint.config.js
```