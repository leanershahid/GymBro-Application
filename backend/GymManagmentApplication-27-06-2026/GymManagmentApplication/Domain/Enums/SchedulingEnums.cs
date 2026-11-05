namespace GymManagmentApplication.Domain.Enums;

// Classes, bookings, attendance and access control.

public enum AttendanceMethod { Qr, Face, Biometric, Pin, Card, Manual, Location }
public enum ClassStatus { Scheduled, InProgress, Completed, Cancelled }
public enum BookingStatus { Booked, Waitlisted, Attended, NoShow, Cancelled }
public enum AccessDeviceType { QrReader, FaceCam, Biometric, CardReader, PinPad }
public enum AccessEventType { Entry, Exit, Denied, Alarm }
public enum AccessMethod { Qr, Face, Biometric, Card, Pin, Manual }
