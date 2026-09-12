import { View, Text, Pressable } from 'react-native';

interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export default function PaginationFooter({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  const atFirst = page <= 1;
  const atLast = page >= totalPages;

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginVertical: 16 }}>
      <Pressable
        onPress={() => onChange(Math.max(1, page - 1))}
        disabled={atFirst}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
        accessibilityState={{ disabled: atFirst }}
        style={{
          paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
          backgroundColor: '#151915', borderWidth: 1, borderColor: '#242B24',
          opacity: atFirst ? 0.4 : 1,
        }}
      >
        <Text style={{ color: '#7ED321', fontWeight: '700' }}>Prev</Text>
      </Pressable>

      <View
        accessibilityLabel={`Page ${page} of ${totalPages}`}
        style={{ backgroundColor: '#7ED321', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}
      >
        <Text style={{ color: '#000', fontWeight: '900' }}>{page} / {totalPages}</Text>
      </View>

      <Pressable
        onPress={() => onChange(Math.min(totalPages, page + 1))}
        disabled={atLast}
        accessibilityRole="button"
        accessibilityLabel="Next page"
        accessibilityState={{ disabled: atLast }}
        style={{
          paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
          backgroundColor: '#151915', borderWidth: 1, borderColor: '#242B24',
          opacity: atLast ? 0.4 : 1,
        }}
      >
        <Text style={{ color: '#7ED321', fontWeight: '700' }}>Next</Text>
      </Pressable>
    </View>
  );
}
