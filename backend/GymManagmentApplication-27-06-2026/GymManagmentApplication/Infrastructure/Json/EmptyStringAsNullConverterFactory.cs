using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymManagmentApplication.Infrastructure.Json;

/// <summary>
/// Forms send "" for optional fields the user left blank. For nullable value types
/// (dates, numbers, enums, Guid) treat "" / whitespace as null instead of failing the whole
/// request with "The JSON value could not be converted to System.Nullable`1[...]".
/// Dates also accept a few unambiguous everyday formats besides ISO yyyy-MM-dd.
/// </summary>
public sealed class EmptyStringAsNullConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) =>
        Nullable.GetUnderlyingType(typeToConvert) is { } t &&
        (t == typeof(DateOnly) || t == typeof(DateTime) || t == typeof(DateTimeOffset) || t == typeof(TimeOnly) ||
         t == typeof(Guid) || t.IsEnum || t.IsPrimitive || t == typeof(decimal));

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options) =>
        (JsonConverter)Activator.CreateInstance(
            typeof(NullableConverter<>).MakeGenericType(Nullable.GetUnderlyingType(typeToConvert)!))!;

    private sealed class NullableConverter<T> : JsonConverter<T?> where T : struct
    {
        private static readonly string[] DateFormats = ["yyyy-MM-dd", "dd/MM/yyyy", "dd-MM-yyyy", "yyyy/MM/dd"];

        public override T? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null) return null;

            if (reader.TokenType == JsonTokenType.String)
            {
                var s = reader.GetString();
                if (string.IsNullOrWhiteSpace(s)) return null;

                if (typeof(T) == typeof(DateOnly))
                {
                    if (DateOnly.TryParseExact(s.Trim(), DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
                        return (T)(object)d;
                    if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var dt))
                        return (T)(object)DateOnly.FromDateTime(dt);
                    throw new JsonException($"'{s}' is not a valid date. Use YYYY-MM-DD.");
                }
            }

            // Everything else: the framework's normal handling for T.
            return JsonSerializer.Deserialize<T>(ref reader, options);
        }

        public override void Write(Utf8JsonWriter writer, T? value, JsonSerializerOptions options)
        {
            if (value is null) writer.WriteNullValue();
            else JsonSerializer.Serialize(writer, value.Value, options);
        }
    }
}
