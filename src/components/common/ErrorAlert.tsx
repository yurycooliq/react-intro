import { Box, Text, CloseButton, HStack } from '@chakra-ui/react'

interface ErrorAlertProps {
  message: string
  onClose?: () => void
}

export default function ErrorAlert({ message, onClose }: ErrorAlertProps) {
  return (
    <Box bg="red.600" color="white" borderRadius="md" p={3} mb={4}>
      <HStack justify="space-between">
        <Text>{message}</Text>
        {onClose && <CloseButton onClick={onClose} />}
      </HStack>
    </Box>
  )
}
