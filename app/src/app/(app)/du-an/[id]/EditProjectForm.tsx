'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

interface Project {
  id: string
  name: string
  startDate: string
  endDate: string
  departmentId: string
}

interface EditProjectFormProps {
  project: Project
}

const EditProjectSchema = z.object({
  name: z.string().min(1, 'Tên dự án không được trống').max(200),
  endDate: z.string().datetime('Ngày kết thúc không hợp lệ'),
})

type EditProjectFormData = z.infer<typeof EditProjectSchema>

export function EditProjectForm({ project }: EditProjectFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<EditProjectFormData>({
    resolver: zodResolver(EditProjectSchema),
    defaultValues: {
      name: project.name,
      endDate: project.endDate.slice(0, 16),
    },
  })

  async function onSubmit(data: EditProjectFormData) {
    try {
      setError(null)
      setIsLoading(true)

      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          endDate: new Date(data.endDate).toISOString(),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Cập nhật dự án thất bại')
      }

      router.push(`/du-an/${project.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Chỉnh sửa dự án</h2>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên dự án</FormLabel>
                <FormControl>
                  <Input placeholder="Nhập tên dự án" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <FormLabel className="text-sm font-medium text-gray-700">Ngày bắt đầu (không thể thay đổi)</FormLabel>
            <Input type="datetime-local" value={project.startDate.slice(0, 16)} disabled className="bg-gray-50" />
          </div>

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ngày kết thúc</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
