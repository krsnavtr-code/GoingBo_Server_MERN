# TBO Flight API Integration

This document outlines the implementation details and testing procedures for the TBO Flight API integration.

## Implementation Details

### Authentication
- Uses OAuth2-like token-based authentication
- Tokens are valid for 24 hours and are automatically refreshed when expired
- Client ID: `ApiIntegrationNew` (as per TBO guidelines)
- Authentication endpoint: `https://api.tektravels.com/SharedAPI/SharedData.svc/rest/Authenticate`

### Key Components

1. **travelBoutiqueApi.js**
   - Handles all TBO API communication
   - Manages authentication tokens
   - Implements request/response logging
   - Handles errors and automatic retries

2. **testCases.js**
   - Contains test cases for various flight search scenarios
   - Validates API responses against expected results
   - Generates detailed test reports

3. **testTboIntegration.js**
   - Test runner for TBO API integration tests
   - Executes test cases and generates reports
   - Can be run manually or as part of CI/CD

### Environment Variables

```env
# TBO API Credentials
TRAVEL_BOUTIQUE_USERNAME=your_username
TRAVEL_BOUTIQUE_PASSWORD=your_password

# API Endpoints
TRAVEL_BOUTIQUE_API_URL=https://api.tektravels.com/SharedAPI/SharedData.svc/rest
TRAVEL_BOUTIQUE_FLIGHT_API_URL=https://api.tektravels.com/SharedAPI/SharedData.svc/rest
TRAVEL_BOUTIQUE_BOOKING_API_URL=https://api.tektravels.com/SharedAPI/SharedData.svc/rest

# Logging
LOG_LEVEL=debug
NODE_ENV=development
```

## Testing

### Running Tests

1. **Unit Tests**
   ```bash
   npm test
   ```

2. **Integration Tests**
   ```bash
   node --experimental-modules --es-module-specifier-resolution=node server/scripts/testTboIntegration.js
   ```

### Test Cases

1. **TC1**: One-way domestic flight (Non-LCC)
2. **TC2**: Round-trip domestic flight (Non-LCC)
3. **TC3**: One-way international flight (Non-LCC)
4. **TC4**: Round-trip international flight (Non-LCC)
5. **TC5**: One-way domestic flight (LCC)
6. **TC6**: Round-trip domestic flight (LCC)
7. **TC7**: Multi-city flight (Non-LCC)
8. **TC8**: Flight with special services (meal, baggage, seat)
9. **TC9**: Error scenarios (invalid dates, routes, etc.)
10. **TC10**: Booking flow test (search → fare quote → book → ticket)

## Logging

All API requests and responses are logged to JSON files in the `logs/TBO` directory with the following structure:

```json
{
  "timestamp": "2025-11-12T17:15:30.123Z",
  "type": "REQUEST|RESPONSE|ERROR",
  "traceId": "t1700000000123abc123",
  "endpoint": "/Search",
  "request": { ... },
  "response": { ... },
  "error": { ... },
  "durationMs": 123
}
```

## Best Practices

1. **Token Management**
   - Generate only one token per day (tokens are valid for 24 hours)
   - Reuse tokens for multiple requests
   - Handle token expiration gracefully

2. **Error Handling**
   - Implement proper error handling for all API calls
   - Log detailed error information
   - Provide user-friendly error messages

3. **Performance**
   - Use GZIP compression for requests and responses
   - Implement request timeouts
   - Cache frequent requests when appropriate

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify credentials
   - Check token expiration
   - Ensure correct API endpoints

2. **Connection Issues**
   - Verify network connectivity
   - Check firewall settings
   - Ensure VPS IP is whitelisted

3. **API Errors**
   - Check error responses for details
   - Verify request parameters
   - Consult TBO API documentation

## Support

For TBO API support, contact:
- Email: support@tbo.com
- Phone: +91-XXXXXXXXXX
- Website: https://www.tbotech.com/

## License

This integration is proprietary and confidential. Unauthorized use or distribution is prohibited.
