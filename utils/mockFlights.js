const mockFlights = {
  success: true,
  data: {
    session_id: 'sess_mock_12345',
    flights: [
      {
        result_index: 'F1',
        airline: 'AI',
        airline_name: 'Air India',
        flight_number: 'AI-101',
        origin: 'DEL',
        origin_name: 'Indira Gandhi International Airport',
        destination: 'BOM',
        destination_name: 'Chhatrapati Shivaji Maharaj International Airport',
        departure_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        arrival_time: new Date(Date.now() + 86400000 + 7200000).toISOString(), // +2 hours
        duration: '2h 30m',
        stops: 0,
        aircraft_type: 'Boeing 787-8',
        cabin_class: 'Economy',
        price: {
          total: 7500.00,
          base: 6300.00,
          taxes: 1200.00,
          currency: 'INR'
        },
        fare_rules: 'Fully refundable. Changes allowed with a fee.'
      },
      {
        result_index: 'F2',
        airline: 'UK',
        airline_name: 'Vistara',
        flight_number: 'UK-701',
        origin: 'DEL',
        origin_name: 'Indira Gandhi International Airport',
        destination: 'BOM',
        destination_name: 'Chhatrapati Shivaji Maharaj International Airport',
        departure_time: new Date(Date.now() + 86400000 + 3600000).toISOString(), // Tomorrow +1 hour
        arrival_time: new Date(Date.now() + 86400000 + 10800000).toISOString(), // +3 hours
        duration: '2h 0m',
        stops: 0,
        aircraft_type: 'Airbus A320',
        cabin_class: 'Economy',
        price: {
          total: 8200.00,
          base: 7000.00,
          taxes: 1200.00,
          currency: 'INR'
        },
        fare_rules: 'Partially refundable. Changes allowed with a fee.'
      },
      {
        result_index: 'F3',
        airline: '6E',
        airline_name: 'IndiGo',
        flight_number: '6E-5021',
        origin: 'DEL',
        origin_name: 'Indira Gandhi International Airport',
        destination: 'BOM',
        destination_name: 'Chhatrapati Shivaji Maharaj International Airport',
        departure_time: new Date(Date.now() + 86400000 - 3600000).toISOString(), // Tomorrow -1 hour
        arrival_time: new Date(Date.now() + 86400000 + 5400000).toISOString(), // +1.5 hours
        duration: '2h 30m',
        stops: 0,
        aircraft_type: 'Airbus A320neo',
        cabin_class: 'Economy',
        price: {
          total: 6800.00,
          base: 5600.00,
          taxes: 1200.00,
          currency: 'INR'
        },
        fare_rules: 'Non-refundable. Changes not allowed.'
      },
      {
        result_index: 'F4',
        airline: 'SG',
        airline_name: 'SpiceJet',
        flight_number: 'SG-123',
        origin: 'DEL',
        origin_name: 'Indira Gandhi International Airport',
        destination: 'BOM',
        destination_name: 'Chhatrapati Shivaji Maharaj International Airport',
        departure_time: new Date(Date.now() + 86400000 + 7200000).toISOString(), // Tomorrow +2 hours
        arrival_time: new Date(Date.now() + 86400000 + 14400000).toISOString(), // +4 hours
        duration: '2h 0m',
        stops: 1,
        layovers: [
          {
            airport: 'IDR',
            duration: '1h 30m',
            arrival: new Date(Date.now() + 86400000 + 9000000).toISOString(),
            departure: new Date(Date.now() + 86400000 + 9900000).toISOString()
          }
        ],
        aircraft_type: 'Boeing 737',
        cabin_class: 'Economy',
        price: {
          total: 5500.00,
          base: 4300.00,
          taxes: 1200.00,
          currency: 'INR'
        },
        fare_rules: 'Non-refundable. Changes not allowed.'
      },
      {
        result_index: 'F5',
        airline: 'AI',
        airline_name: 'Air India',
        flight_number: 'AI-201',
        origin: 'DEL',
        origin_name: 'Indira Gandhi International Airport',
        destination: 'BOM',
        destination_name: 'Chhatrapati Shivaji Maharaj International Airport',
        departure_time: new Date(Date.now() + 86400000 + 14400000).toISOString(), // Tomorrow +4 hours
        arrival_time: new Date(Date.now() + 86400000 + 19800000).toISOString(), // +5.5 hours
        duration: '2h 30m',
        stops: 0,
        aircraft_type: 'Boeing 777',
        cabin_class: 'Business',
        price: {
          total: 18500.00,
          base: 17000.00,
          taxes: 1500.00,
          currency: 'INR'
        },
        fare_rules: 'Fully refundable. Changes allowed without fee.'
      }
    ]
  }
};

// Function to filter flights based on search parameters
function filterFlights(params) {
  const { origin, destination, departure_date, cabin_class, non_stop } = params;
  
  let filteredFlights = [...mockFlights.data.flights];
  
  // Filter by origin and destination
  if (origin) {
    filteredFlights = filteredFlights.filter(
      flight => flight.origin === origin.toUpperCase()
    );
  }
  
  if (destination) {
    filteredFlights = filteredFlights.filter(
      flight => flight.destination === destination.toUpperCase()
    );
  }
  
  // Filter by cabin class
  if (cabin_class) {
    filteredFlights = filteredFlights.filter(
      flight => flight.cabin_class.toLowerCase() === cabin_class.toLowerCase()
    );
  }
  
  // Filter non-stop flights
  if (non_stop) {
    filteredFlights = filteredFlights.filter(flight => flight.stops === 0);
  }
  
  // Sort by departure time
  filteredFlights.sort((a, b) => 
    new Date(a.departure_time) - new Date(b.departure_time)
  );
  
  return {
    ...mockFlights,
    data: {
      ...mockFlights.data,
      flights: filteredFlights
    }
  };
}

// Mock API functions
const mockApi = {
  searchFlights: async (params) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return filterFlights(params);
  },
  
  getFareRules: async (sessionId, resultIndex) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    const flight = mockFlights.data.flights.find(f => f.result_index === resultIndex);
    
    if (!flight) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Flight not found'
        }
      };
    }
    
    return {
      success: true,
      data: {
        fare_rules: flight.fare_rules,
        restrictions: 'Some restrictions may apply. Please check with the airline for details.'
      }
    };
  },
  
  bookFlight: async (bookingData) => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate a random PNR
    const pnr = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    return {
      success: true,
      data: {
        booking_reference: `BK-${pnr}`,
        pnr: pnr,
        status: 'CONFIRMED',
        flights: bookingData.result_index ? 
          [mockFlights.data.flights.find(f => f.result_index === bookingData.result_index)] : [],
        passengers: bookingData.passengers || [],
        contact_info: bookingData.contact_info || {},
        total_amount: bookingData.payment?.amount || 0,
        currency: 'INR',
        booking_date: new Date().toISOString()
      }
    };
  }
};

// Export the mock API functions
export const searchFlights = mockApi.searchFlights;
export const getFareRules = mockApi.getFareRules;
export const bookFlight = mockApi.bookFlight;
