# LITTR.co - Vape & Battery Recycling Platform

## Overview

LITTR.co is a modern recycling company website focused on disposable vapes and lithium-ion battery recovery. The platform serves the Rochester, NY area, offering free drop-off locations for consumers and bin programs for businesses. The application features a minimalist black/white design aesthetic with form submissions for business bin requests, contact inquiries, and volunteer applications.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS v4 with custom CSS variables for theming (black/white minimalist palette)
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **State Management**: Zustand with persistence for client-side state, TanStack React Query for server state
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **API Design**: RESTful endpoints under `/api/*` prefix
- **Development**: Vite dev server with HMR proxied through Express
- **Production**: Static file serving from built client assets

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Tables**: users, contacts, binRequests, volunteers
- **Validation**: Drizzle-Zod for automatic schema-to-validation conversion

### Project Structure
```
├── client/           # Frontend React application
│   ├── src/
│   │   ├── components/  # UI components (shadcn/ui + custom)
│   │   ├── pages/       # Route page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilities, query client, store
├── server/           # Backend Express application
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database access layer
│   └── db.ts         # Database connection
├── shared/           # Shared code between client/server
│   └── schema.ts     # Drizzle schema definitions
└── migrations/       # Database migrations
```

### Key Design Patterns
- **Shared Schema**: Database types and validation schemas shared between frontend and backend
- **Storage Interface**: Abstract IStorage interface allowing for different storage implementations
- **Path Aliases**: `@/` for client source, `@shared/` for shared modules, `@assets/` for attached assets

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and migrations
- **drizzle-kit**: Database migration tooling (`npm run db:push`)

### UI/Frontend Libraries
- **Radix UI**: Accessible component primitives (dialogs, accordions, forms, etc.)
- **Lucide React**: Icon library
- **Embla Carousel**: Carousel functionality
- **date-fns**: Date formatting utilities

### Build & Development
- **Vite**: Frontend build tool with React plugin
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development

### Form & Validation
- **Zod**: Schema validation
- **React Hook Form**: Form state management
- **zod-validation-error**: Human-readable validation errors