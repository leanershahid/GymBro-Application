using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymManagmentApplication.Infrastructure.Json;

/// <summary>
/// Request bodies may send enums by name ("Inactive", case-insensitive) or by number.
/// Responses keep writing numbers, so existing clients see no change.
/// </summary>
public sealed class FlexibleEnumConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) => typeToConvert.IsEnum;

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options) =>
        (JsonConverter)Activator.CreateInstance(typeof(EnumConverter<>).MakeGenericType(typeToConvert))!;

    private sealed class EnumConverter<T> : JsonConverter<T> where T : struct, Enum
    {
        public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt64(out var n))
            {
                var value = (T)Enum.ToObject(typeof(T), n);
                if (Enum.IsDefined(value)) return value;
            }
            else if (reader.TokenType == JsonTokenType.String)
            {
                var s = reader.GetString();
                if (Enum.TryParse<T>(s, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)) return parsed;
            }
            throw new JsonException($"Choose one of: {string.Join(", ", Enum.GetNames<T>())}.");
        }

        public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options) =>
            writer.WriteNumberValue(Convert.ToInt64(value));
    }
}
