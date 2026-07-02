import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // If the request is for our API, proxy it to the dynamically configured backend
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const backendUrl = process.env.BACKEND_URL || 'http://news-app:8999';
    
    // Construct the target URL using the backend URL
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, backendUrl);
    
    return NextResponse.rewrite(url);
  }
}

// Only run the middleware for /api/* paths
export const config = {
  matcher: '/api/:path*',
};
